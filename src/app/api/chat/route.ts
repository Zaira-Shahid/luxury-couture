import { type NextRequest, NextResponse } from "next/server";

import { getAiProvider } from "@/lib/ai";
import { looksLikeDiscovery, parseQueryIntent } from "@/lib/ai/query-intent";
import { getActiveCategories } from "@/lib/catalog/get-categories";
import { getBuilderOptionSets } from "@/lib/builder/get-options";
import { getActiveOccasions } from "@/lib/catalog/get-occasions";
import { getPublishedProducts } from "@/lib/catalog/get-products";
import { checkChatRateLimit, clientIpFrom } from "@/lib/chat/rate-limit";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * The customer chatbot endpoint (Module 23).
 *
 * Order of operations matters and is deliberate:
 *   1. validate input
 *   2. RATE LIMIT — before anything that costs money or touches the AI
 *   3. parse intent / answer from FAQs
 *   4. resolve products from the DATABASE, never from model output
 *   5. log the turn (including whether it went unanswered)
 *
 * No consent gate: this is a functional feature the visitor actively
 * initiated by typing a message, not background tracking. It sets no
 * analytics identifier and is not covered by the analytics consent
 * category. The session id is client-generated per conversation.
 */

const MAX_MESSAGE_LENGTH = 500;
const MAX_RESULTS = 4;

type ChatProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  imageUrl: string | null;
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, sessionId } = (body ?? {}) as { message?: unknown; sessionId?: unknown };

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "That message is too long." }, { status: 413 });
  }
  if (typeof sessionId !== "string" || sessionId.length < 8 || sessionId.length > 100) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }

  const trimmed = message.trim();

  // 2. Rate limit BEFORE any provider call or catalogue read.
  const limit = await checkChatRateLimit({
    sessionId,
    ip: clientIpFrom(request.headers),
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { reply: limit.message, products: [], unanswered: false, rateLimited: true },
      { status: 429, headers: limit.retryAfterSeconds ? { "retry-after": String(limit.retryAfterSeconds) } : undefined }
    );
  }

  try {
    const [occasions, categories, optionSets] = await Promise.all([
      getActiveOccasions(),
      getActiveCategories(),
      getBuilderOptionSets(),
    ]);

    const vocabulary = {
      occasions: occasions.map((o) => ({ slug: o.slug, name: o.name })),
      colours: optionSets.colours.map((c) => ({ slug: c.slug, name: c.name })),
      fabrics: optionSets.fabrics.map((f) => ({ slug: f.slug, name: f.name })),
      categories: categories.map((c) => ({ slug: c.slug, name: c.name })),
    };

    // Cheap local classification first, so an obvious FAQ question never
    // costs an API request.
    const localIntent = parseQueryIntent(trimmed, vocabulary);
    const isDiscovery = looksLikeDiscovery(trimmed, localIntent);

    const provider = getAiProvider();

    let reply: string;
    let products: ChatProduct[] = [];
    let sourceFaqId: string | null = null;
    let unanswered = false;

    if (isDiscovery) {
      const intent = await provider.interpretQuery(trimmed, vocabulary);

      // 4. Products come from the database. The model only supplied
      // filters; it never names a product.
      const rows = intent.isEmpty
        ? []
        : await getPublishedProducts({
            q: intent.freeText || undefined,
            occasionSlug: intent.occasionSlug ?? undefined,
            colourNames: intent.colourNames,
            fabricNames: intent.fabricNames,
            categorySlug: intent.categorySlug ?? undefined,
            limit: MAX_RESULTS,
          });

      products = rows.map((row) => {
        const primary =
          row.product_images.find((img) => img.is_primary) ?? row.product_images[0] ?? null;
        return {
          id: row.id,
          name: row.name,
          slug: row.slug,
          price: Number(row.base_price),
          currency: row.currency,
          imageUrl: primary?.url ?? null,
        };
      });

      if (products.length > 0) {
        const occasionName = intent.occasionSlug
          ? occasions.find((o) => o.slug === intent.occasionSlug)?.name
          : null;
        reply = occasionName
          ? `Here are some pieces that suit a ${occasionName.toLowerCase()}:`
          : "Here are some pieces that might suit:";
      } else {
        // No invented alternatives, no apologetic waffle — say so and
        // offer the two things that actually help.
        unanswered = true;
        reply =
          "I couldn't find anything matching that in our current collection. You could design your own piece in the custom builder, or send us a message and our team will help you find something.";
      }
    } else {
      const answer = await provider.answerQuestion(trimmed);
      if (answer.answer) {
        reply = answer.answer;
        sourceFaqId = answer.sourceFaqId;
      } else {
        reply = answer.fallbackMessage;
        unanswered = true;
      }
    }

    // 5. Log the turn. Awaited, not fire-and-forget: a serverless
    // instance can be frozen the moment the response is returned, which
    // would silently lose the FAQ backlog — the most valuable thing this
    // endpoint produces. Two small inserts are worth the wait.
    // Service-role, because the chat tables are admin-read-only with no
    // insert policy, so a visitor can never forge a transcript.
    await logTurn({ sessionId, userMessage: trimmed, reply, sourceFaqId, unanswered });

    return NextResponse.json({ reply, products, unanswered, rateLimited: false });
  } catch (error) {
    logger.error("chat request failed", error);
    return NextResponse.json(
      {
        reply:
          "Something went wrong at our end. Please use the contact form and our team will get back to you.",
        products: [],
        unanswered: true,
        rateLimited: false,
      },
      { status: 200 }
    );
  }
}

/**
 * Persists the exchange. Unanswered questions are the FAQ backlog — the
 * questions customers actually ask that the knowledge base doesn't cover
 * — surfaced in Admin → Content.
 *
 * Failures are swallowed: a logging problem must not cost the customer
 * their answer.
 */
async function logTurn(params: {
  sessionId: string;
  userMessage: string;
  reply: string;
  sourceFaqId: string | null;
  unanswered: boolean;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("chat_conversations")
      .select("id")
      .eq("session_id", params.sessionId)
      .maybeSingle();

    let conversationId = existing?.id as string | undefined;
    if (!conversationId) {
      const { data: created } = await admin
        .from("chat_conversations")
        .insert({ session_id: params.sessionId, profile_id: user?.id ?? null })
        .select("id")
        .single();
      conversationId = created?.id as string | undefined;
    }
    if (!conversationId) {
      logger.warn("chat conversation could not be created", { sessionId: params.sessionId });
      return;
    }

    // Both objects MUST carry an identical key set: PostgREST rejects a
    // bulk insert of heterogeneous objects with "All object keys must
    // match". Getting this wrong silently wrote nothing at all — caught
    // only because the error is now checked below, which is why it is.
    const { error: messagesError } = await admin.from("chat_messages").insert([
      {
        conversation_id: conversationId,
        role: "user",
        content: params.userMessage,
        source_faq_id: null,
        // Flagged on the QUESTION, not the reply: the backlog is a list
        // of things customers asked that we couldn't answer, so the admin
        // screen reads user rows directly rather than having to walk back
        // from an assistant row to the message before it.
        unanswered: params.unanswered,
      },
      {
        conversation_id: conversationId,
        role: "assistant",
        content: params.reply,
        source_faq_id: params.sourceFaqId,
        unanswered: false,
      },
    ]);

    if (messagesError) {
      logger.warn("chat message insert failed", { message: messagesError.message });
    }
  } catch (error) {
    logger.warn("chat transcript logging failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

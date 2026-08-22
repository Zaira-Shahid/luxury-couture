import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { logger } from "@/lib/logger";
import type { Product } from "@/types/database";

import { DeterministicAiProvider } from "./deterministic-provider";
import { GUARDRAIL_PROMPT, applyGuardrails } from "./guardrails";
import { buildFallbackMessage, getAiKnowledge } from "./knowledge";
import type {
  AiAnswer,
  AiProvider,
  AiRecommendation,
  EmailDraft,
  EmailDraftInput,
  ProductDescriptionInput,
} from "./provider";

/**
 * Claude-backed provider. Active only when ANTHROPIC_API_KEY is set —
 * exactly the pattern lib/payments/ uses for Stripe (`isStripeConfigured()`),
 * so the project still runs end to end with no key and no cost.
 *
 * Three things make this safe to switch on:
 *
 *  1. EVERY method falls back to DeterministicAiProvider on any failure —
 *     API error, refusal, timeout, or a response that fails schema
 *     validation. An AI outage degrades quality, never availability.
 *  2. Every output is run through applyGuardrails() before it is returned,
 *     the same as the deterministic provider's output. The model is also
 *     told the rules via GUARDRAIL_PROMPT, but the regex check is what
 *     enforces them.
 *  3. Context comes only from getAiKnowledge() — admin-curated FAQs and
 *     public catalogue names. No customer, order or payment data is ever
 *     put in a prompt.
 *
 * Recommendations deliberately still come from the deterministic SQL
 * chain: ranking products by co-view counts is arithmetic, and paying a
 * model to re-do arithmetic would be slower, costlier and less accurate.
 */

const MODEL = "claude-opus-5";

/**
 * These outputs are a paragraph or two. The SDK default of ~16k is for
 * open-ended generation; a deliberately short output is the documented
 * reason to set this lower, and it caps the cost of a runaway response.
 */
const MAX_TOKENS = 2048;

/** Fail fast: an admin clicking "Generate" should not wait on a hung request. */
const REQUEST_TIMEOUT_MS = 30_000;

const AnswerSchema = z.object({
  answer: z
    .string()
    .describe("The answer, or an empty string if the FAQs do not cover the question."),
  faq_id: z
    .string()
    .describe("The id of the FAQ this answer came from, or an empty string if none."),
  confident: z.boolean().describe("True only if the FAQs directly answer the question."),
});

const EmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export class ClaudeAiProvider implements AiProvider {
  readonly name = "claude";

  private readonly client: Anthropic;
  private readonly fallback = new DeterministicAiProvider();

  constructor(client?: Anthropic) {
    // Injectable so tests can supply a client that always throws and
    // assert the fallback path without needing a real API key.
    this.client = client ?? new Anthropic({ timeout: REQUEST_TIMEOUT_MS });
  }

  /** Logs the real error server-side; callers only ever see degraded output. */
  private logFailure(operation: string, error: unknown) {
    if (error instanceof Anthropic.RateLimitError) {
      logger.warn("claude rate limited, falling back", { operation });
    } else if (error instanceof Anthropic.AuthenticationError) {
      logger.error("claude auth failed — check ANTHROPIC_API_KEY", error, { operation });
    } else if (error instanceof Anthropic.APIError) {
      logger.warn("claude api error, falling back", { operation, status: error.status });
    } else {
      logger.warn("claude call failed, falling back", {
        operation,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async answerQuestion(question: string): Promise<AiAnswer> {
    const knowledge = await getAiKnowledge();
    const fallbackMessage = buildFallbackMessage(knowledge.contactEmail);

    if (knowledge.faqs.length === 0) {
      return { answer: null, sourceFaqId: null, confidence: 0, fallbackMessage };
    }

    try {
      const faqBlock = knowledge.faqs
        .map((faq) => `<faq id="${faq.id}">\nQ: ${faq.question}\nA: ${faq.answer}\n</faq>`)
        .join("\n");

      const response = await this.client.messages.parse({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // Thinking helps it decide whether the FAQs genuinely cover the
        // question rather than reaching for the nearest one; low effort
        // is plenty for a short lookup-and-judge task.
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: zodOutputFormat(AnswerSchema) },
        system: [
          `You answer customer questions for ${knowledge.brandName}, a UK custom lehenga atelier.`,
          "Answer ONLY from the FAQs provided. If they do not cover the question, set confident to false and leave answer empty. Never guess and never use outside knowledge.",
          GUARDRAIL_PROMPT,
        ].join("\n\n"),
        messages: [{ role: "user", content: `${faqBlock}\n\nCustomer question: ${question}` }],
      });

      const parsed = response.parsed_output;
      if (!parsed || !parsed.confident || !parsed.answer.trim()) {
        return { answer: null, sourceFaqId: null, confidence: 0, fallbackMessage };
      }

      // A non-clean answer is discarded rather than shown redacted — a
      // customer must never see redaction markers.
      const guarded = applyGuardrails(parsed.answer);
      if (!guarded.clean) {
        logger.warn("claude answer failed guardrails, suppressing", {
          rules: guarded.violations.map((v) => v.rule),
        });
        return { answer: null, sourceFaqId: null, confidence: 0, fallbackMessage };
      }

      const faqExists = knowledge.faqs.some((faq) => faq.id === parsed.faq_id);
      return {
        answer: guarded.text,
        sourceFaqId: faqExists ? parsed.faq_id : null,
        confidence: 0.9,
        fallbackMessage,
      };
    } catch (error) {
      this.logFailure("answerQuestion", error);
      return this.fallback.answerQuestion(question);
    }
  }

  /** Ranking is arithmetic over real data — no model involved, by design. */
  async recommendProducts(product: Product, limit: number): Promise<AiRecommendation[]> {
    return this.fallback.recommendProducts(product, limit);
  }

  async writeProductDescription(input: ProductDescriptionInput): Promise<string> {
    try {
      const knowledge = await getAiKnowledge();

      const details = [
        `Product name: ${input.name}`,
        input.categoryName ? `Category: ${input.categoryName}` : null,
        input.attributes.length ? `Details: ${input.attributes.join(", ")}` : null,
        input.existingDescription ? `Existing copy to improve: ${input.existingDescription}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        system: [
          `You write product copy for ${knowledge.brandName}: ${knowledge.brandDescription}`,
          "Write two or three short paragraphs of elegant, editorial product copy. Warm and specific, never breathless or clichéd. Use only the details given — invent no fabrics, measurements, origins or policies.",
          GUARDRAIL_PROMPT,
        ].join("\n\n"),
        messages: [{ role: "user", content: details }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      if (!text) throw new Error("empty response");

      // Redacted rather than discarded: an admin is going to edit this
      // anyway, and seeing what was removed is more useful than a blank box.
      return applyGuardrails(text).text;
    } catch (error) {
      this.logFailure("writeProductDescription", error);
      return this.fallback.writeProductDescription(input);
    }
  }

  async draftEmail(input: EmailDraftInput): Promise<EmailDraft> {
    try {
      const knowledge = await getAiKnowledge();

      const response = await this.client.messages.parse({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: zodOutputFormat(EmailSchema) },
        system: [
          `You draft customer emails for ${knowledge.brandName}, a UK custom lehenga atelier.`,
          "Warm, concise and professional. British English. The draft is reviewed and sent by a human — never claim an action has already happened.",
          GUARDRAIL_PROMPT,
        ].join("\n\n"),
        messages: [
          {
            role: "user",
            content: [
              `Order number: ${input.orderNumber}`,
              `Current status (context only — do not assert any change): ${input.orderStatus}`,
              input.customerName ? `Customer name: ${input.customerName}` : null,
              `What to communicate: ${input.intent}`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      });

      const parsed = response.parsed_output;
      if (!parsed?.body.trim()) throw new Error("empty response");

      return {
        subject: applyGuardrails(parsed.subject).text,
        body: applyGuardrails(parsed.body).text,
      };
    } catch (error) {
      this.logFailure("draftEmail", error);
      return this.fallback.draftEmail(input);
    }
  }
}

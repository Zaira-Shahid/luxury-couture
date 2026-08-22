import type { Product } from "@/types/database";

import { applyGuardrails } from "./guardrails";
import { matchFaq } from "./faq-matching";
import { buildFallbackMessage, getAiKnowledge } from "./knowledge";
import type {
  AiAnswer,
  AiProvider,
  AiRecommendation,
  EmailDraft,
  EmailDraftInput,
  ProductDescriptionInput,
} from "./provider";
import { recommendProductIds } from "./recommendations";

/**
 * The default provider. Runs with zero configuration, costs nothing, and
 * is the fallback the Claude provider drops to on any failure — so this
 * is the behaviour that must always be correct.
 *
 * It cannot hallucinate, because it never generates novel claims: FAQ
 * answers are returned verbatim as an admin wrote them, recommendations
 * come from the ranked SQL chain, and descriptions/emails are composed
 * from real fields. Its weakness is coverage, not accuracy — an unmatched
 * question returns "I don't know" rather than a guess, which is the
 * correct failure for a customer-facing system.
 */

export class DeterministicAiProvider implements AiProvider {
  readonly name = "deterministic";

  /**
   * Delegates to the pure matcher in faq-matching.ts, which is unit
   * tested directly. Returns admin-written FAQ text verbatim or nothing
   * at all — it cannot fabricate an answer.
   */
  async answerQuestion(question: string): Promise<AiAnswer> {
    const knowledge = await getAiKnowledge();
    const fallbackMessage = buildFallbackMessage(knowledge.contactEmail);

    const match = matchFaq(question, knowledge.faqs);
    if (!match) {
      return { answer: null, sourceFaqId: null, confidence: 0, fallbackMessage };
    }

    // Even admin-written text goes through guardrails — a FAQ answer
    // containing "delivery within 3 weeks" would otherwise become a
    // promise the moment a bot repeats it as an answer.
    const guarded = applyGuardrails(match.answer);

    return {
      answer: guarded.text,
      sourceFaqId: match.faqId,
      confidence: match.confidence,
      fallbackMessage,
    };
  }

  async recommendProducts(product: Product, limit: number): Promise<AiRecommendation[]> {
    return recommendProductIds(product, limit);
  }

  /**
   * Composes copy from real fields only. Reads as competent editorial
   * boilerplate — deliberately so; it exists to give the admin a
   * structured starting point, not to impersonate a copywriter.
   */
  async writeProductDescription(input: ProductDescriptionInput): Promise<string> {
    const knowledge = await getAiKnowledge();
    const parts: string[] = [];

    const category = input.categoryName ? ` ${input.categoryName.toLowerCase()}` : "";
    parts.push(
      `${input.name} is a hand-crafted${category} piece from ${knowledge.brandName}, made to order for your occasion.`
    );

    if (input.attributes.length > 0) {
      parts.push(`Crafted with ${formatList(input.attributes)}.`);
    }

    parts.push(
      "Every piece is tailored to your own measurements by our in-house artisans, with the fit, silhouette and finish adjusted to you.",
      "Book a consultation or start a custom design to make this piece entirely your own."
    );

    if (input.existingDescription?.trim()) {
      // Preserve what the admin already wrote rather than discarding it.
      parts.splice(1, 0, input.existingDescription.trim());
    }

    return applyGuardrails(parts.join("\n\n")).text;
  }

  /**
   * Drafts around the admin's stated intent. Note what it does NOT do:
   * it never asserts a status change, never gives a date, never mentions
   * an amount — the three things the plan forbids.
   */
  async draftEmail(input: EmailDraftInput): Promise<EmailDraft> {
    const knowledge = await getAiKnowledge();
    const greeting = input.customerName ? `Dear ${input.customerName},` : "Hello,";

    const body = [
      greeting,
      `Thank you for your order ${input.orderNumber}.`,
      input.intent.trim(),
      "If you have any questions, simply reply to this email and we'll be glad to help.",
      `Warm regards,\n${knowledge.brandName}`,
    ].join("\n\n");

    const guarded = applyGuardrails(body);
    return { subject: `Your order ${input.orderNumber}`, body: guarded.text };
  }
}

function formatList(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

import type { Product } from "@/types/database";

/**
 * Free-first AI provider abstraction (Master Build Plan §3), following the
 * lib/payments/ shape — a real provider plus a working free fallback,
 * selected by whether credentials exist.
 *
 * THE INTERFACE IS DELIBERATELY NARROW. There is no general `complete()`
 * or `chat()` method, and no method takes a table name, an id to write, or
 * a callback. Four fixed capabilities, each returning plain data that a
 * caller renders or an admin edits.
 *
 * That shape is what makes two of the plan's hard rules — "AI must never
 * alter payment records" and "must never alter order status" — true by
 * construction rather than by instruction: no call path exists through
 * which a provider could write anything. The remaining rules (no invented
 * prices, no promised dates) are about generated text and are enforced in
 * guardrails.ts, which runs over every provider's output.
 *
 * Implementations must never throw. A provider that cannot answer returns
 * its documented "no answer" shape; the Claude provider additionally falls
 * back to the deterministic one. An AI outage must never break a page.
 */

export type AiAnswer = {
  /** The answer text, already guardrail-checked. Null when nothing confident was found. */
  answer: string | null;
  /** Which FAQ backed this answer, when one did — so the UI can cite a source. */
  sourceFaqId: string | null;
  /** 0–1. Below the provider's threshold, `answer` is null rather than a guess. */
  confidence: number;
  /** Shown when `answer` is null: how to reach a human instead. */
  fallbackMessage: string;
};

export type AiRecommendation = {
  productId: string;
  /** Why this was suggested — surfaced in admin, useful for debugging ranking. */
  reason: string;
};

export type ProductDescriptionInput = {
  name: string;
  categoryName: string | null;
  /** Existing copy, when rewriting rather than writing fresh. */
  existingDescription: string | null;
  /** Fabric/colour/embroidery names, when the product is linked to builder options. */
  attributes: string[];
};

export type EmailDraftInput = {
  orderNumber: string;
  /** Current status, for context only — the draft must not assert a change to it. */
  orderStatus: string;
  customerName: string | null;
  /** What the admin wants to say, in their own words. */
  intent: string;
};

export type EmailDraft = { subject: string; body: string };

export interface AiProvider {
  /** Human-readable id recorded in the ai_generations audit table. */
  readonly name: string;

  /** Answers a customer question from the FAQ knowledge base only. */
  answerQuestion(question: string): Promise<AiAnswer>;

  /** Ranks products related to `product`. Returns ids; the caller loads the rows. */
  recommendProducts(product: Product, limit: number): Promise<AiRecommendation[]>;

  /** Drafts marketing copy for a product. Never mentions price. */
  writeProductDescription(input: ProductDescriptionInput): Promise<string>;

  /** Drafts a customer email for an admin to review, edit and send. */
  draftEmail(input: EmailDraftInput): Promise<EmailDraft>;
}

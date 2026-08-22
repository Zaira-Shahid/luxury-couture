import { ClaudeAiProvider } from "./claude-provider";
import { DeterministicAiProvider } from "./deterministic-provider";
import type { AiProvider } from "./provider";
import { selectProvider } from "./provider-selection";

export type {
  AiAnswer,
  AiProvider,
  AiRecommendation,
  EmailDraft,
  EmailDraftInput,
  ProductDescriptionInput,
} from "./provider";
export { applyGuardrails, guardedOrNull } from "./guardrails";

/**
 * Mirrors `isStripeConfigured()` (lib/payments/index.ts): a missing key
 * means "not configured yet", not an error. The whole application works
 * without one.
 */
export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Env-selected provider.
 *
 * Defaults to the deterministic engine, so a fresh checkout with no
 * credentials has working FAQ answers, recommendations and drafting.
 * Set ANTHROPIC_API_KEY to upgrade quality; set AI_PROVIDER=deterministic
 * to force the free path even when a key exists (useful for testing the
 * fallback and for keeping cost at zero).
 */
export function getAiProvider(): AiProvider {
  const selected = selectProvider({
    apiKey: process.env.ANTHROPIC_API_KEY,
    override: process.env.AI_PROVIDER,
  });
  return selected === "claude" ? new ClaudeAiProvider() : new DeterministicAiProvider();
}

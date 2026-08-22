/**
 * The enforcement layer for the Master Build Plan's hard rules:
 *
 *   AI must never — invent final prices, promise delivery dates, alter
 *   payment records, alter order status, or bypass admin controls.
 *
 * The first three are about what AI *says*; this file handles those. The
 * last two are handled structurally: `AiProvider` (provider.ts) exposes no
 * method that can write to any table, so no call path exists that could
 * change an order or a payment. That is a stronger guarantee than any
 * text check, which is why the interface is deliberately narrow.
 *
 * Why post-hoc checking and not just prompt instructions: a prompt is a
 * request, not a guarantee. This runs over the output of EVERY provider —
 * including the deterministic one — so a bad template is caught the same
 * way a bad model response is. It has no dependencies and no I/O, which
 * makes it exhaustively testable.
 *
 * Pricing note specific to this business: the plan separates "Estimated
 * Price" from "Final Admin Quote", and only an admin sets the latter. AI
 * free text therefore has no business quoting ANY monetary amount — we
 * cannot tell an accurately-repeated price from an invented one once it is
 * prose, so every amount is redacted and the reader is pointed at the real
 * figure, which the UI already displays from the database.
 */

export type GuardrailViolation = {
  rule: string;
  /** What was matched, for the audit log and the admin-facing warning. */
  match: string;
};

export type GuardrailResult = {
  /** The text with every violation redacted. Safe to display. */
  text: string;
  violations: GuardrailViolation[];
  /** True when nothing had to be redacted. */
  clean: boolean;
};

const REDACTED_AMOUNT = "[price removed — see the quotation]";
const REDACTED_DATE = "[timescale removed — confirmed by our team]";
const REDACTED_STATUS = "[status removed — check your account]";

type Rule = { name: string; pattern: RegExp; replacement: string };

/**
 * Order matters: money runs first so an amount inside a delivery sentence
 * is redacted as an amount rather than swallowed by the date rule.
 */
const RULES: Rule[] = [
  {
    name: "monetary-amount",
    // £1,200 / £1200.50 / GBP 1200 / 1200 GBP / 500 pounds
    pattern:
      /(?:[£$€]\s?\d[\d,]*(?:\.\d{1,2})?)|(?:\b(?:GBP|USD|EUR)\s?\d[\d,]*(?:\.\d{1,2})?)|(?:\b\d[\d,]*(?:\.\d{1,2})?\s?(?:GBP|USD|EUR|pounds?|dollars?|euros?)\b)/gi,
    replacement: REDACTED_AMOUNT,
  },
  {
    name: "delivery-promise",
    // "arrives within 3 weeks", "ready by Friday", "delivered in 10 days",
    // "ships on 14 March", "dispatched tomorrow". Anchored on a fulfilment
    // verb + a preposition so ordinary copy like "hand-made in Pakistan"
    // is untouched — the verb alone would be far too broad.
    //
    // The determiner before a weekday or period is OPTIONAL: "ready by
    // Friday" and "ships in weeks" are promises just as much as "ready by
    // this Friday". Requiring one was a real gap, caught by test-ai.mjs.
    pattern:
      /\b(?:arrive|arrives|arriving|deliver|delivers|delivered|delivery|dispatch|dispatched|dispatches|ship|ships|shipped|shipping|ready|complete|completed|finish|finished)\b[^.!?\n]{0,40}?(?:\s+\b(?:by|on|within|in|after|before|over)\b)?\s+(?:(?:about|around|approximately)\s+)?(?:\d+\s*(?:[-–]\s*\d+\s*)?(?:hour|day|week|month|working day|business day)s?|(?:(?:next|this|the)\s+)?(?:weeks?|months?|weekend)\b|(?:(?:next|this)\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b|tomorrow|today|tonight|\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2})/gi,
    replacement: REDACTED_DATE,
  },
  {
    name: "delivery-guarantee",
    pattern:
      /\b(?:guarantee|guaranteed|promise|promised|assured?)\b[^.!?\n]{0,50}?\b(?:deliver\w*|arriv\w*|dispatch\w*|ship\w*|ready)\b/gi,
    replacement: REDACTED_DATE,
  },
  {
    name: "order-status-claim",
    // "your order has shipped", "your payment was received"
    pattern:
      /\byour\s+(?:order|payment|parcel|package|item|lehenga)\b[^.!?\n]{0,40}?\b(?:has|have|is|are|was|were|been)\b[^.!?\n]{0,20}?\b(?:shipped|dispatched|delivered|confirmed|paid|received|refunded|cancelled|canceled|completed|processed|approved)\b/gi,
    replacement: REDACTED_STATUS,
  },
  {
    name: "payment-state-claim",
    pattern:
      /\b(?:payment|refund|deposit|balance)\b[^.!?\n]{0,30}?\b(?:has been|have been|was|were|is|are)\b\s+(?:successfully\s+)?(?:received|processed|completed|issued|taken|charged|refunded|settled)\b/gi,
    replacement: REDACTED_STATUS,
  },
];

/**
 * Redacts every rule violation and reports what was caught.
 *
 * Callers choose what to do with a non-clean result:
 *  - admin draft surfaces show the redacted text plus a warning, because
 *    the admin is going to edit it anyway and seeing what happened is
 *    more useful than a blank box;
 *  - customer-facing answers (Module 23) should discard a non-clean
 *    result entirely and fall back to "contact us" — never show a
 *    customer a message full of redaction markers.
 */
export function applyGuardrails(input: string): GuardrailResult {
  const violations: GuardrailViolation[] = [];
  let text = input;

  for (const rule of RULES) {
    // Fresh lastIndex each pass: these are /g regexes and are module-level
    // constants, so a leftover lastIndex would skip matches on later calls.
    rule.pattern.lastIndex = 0;
    const matches = text.match(rule.pattern);
    if (matches) {
      for (const match of matches) violations.push({ rule: rule.name, match: match.trim() });
      rule.pattern.lastIndex = 0;
      text = text.replace(rule.pattern, rule.replacement);
    }
  }

  return { text, violations, clean: violations.length === 0 };
}

/**
 * Convenience for customer-facing paths: returns the text only when it is
 * clean, otherwise null so the caller can fall back to a human handoff.
 */
export function guardedOrNull(input: string): string | null {
  const result = applyGuardrails(input);
  return result.clean ? result.text : null;
}

/**
 * The instruction block appended to every model prompt. The regex rules
 * above are the enforcement; this exists so a well-behaved model does not
 * generate text that needs redacting in the first place.
 */
export const GUARDRAIL_PROMPT = `Hard rules you must never break:
- Never state, estimate, or imply any price, cost, deposit or discount amount. Pricing is set by the admin team only and is shown to the customer elsewhere.
- Never promise, estimate or imply a delivery, dispatch, completion or production date or timescale.
- Never claim anything about the state of an order, payment or refund (for example that something has shipped, been received, or been confirmed).
- Never invent product details, materials, measurements or policies that are not in the information you were given. If you do not know, say so.
- You are drafting text for a human to review. You are not taking any action.`;

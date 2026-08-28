/**
 * Redaction for audit rows (Master Build Plan section 12B.7).
 *
 * NO IMPORTS on purpose, following the same rule as lib/auth/permissions.ts
 * and lib/ai/guardrails.ts: `scripts/test-mcp.mjs` imports this `.ts`
 * directly under Node's type stripping, where `@/...` aliases do not
 * resolve. "What never reaches the log" is precisely the kind of rule that
 * has to be provable without a database.
 */

const REDACTED = "[redacted]";
const MAX_STRING = 200;
const MAX_ARRAY = 20;
const MAX_DEPTH = 4;

/**
 * Argument names whose VALUE is never recorded, matched case-insensitively
 * so `apiKey`, `API_KEY` and `api-key` are all caught.
 */
const SENSITIVE_KEY = /(password|secret|token|api[_-]?key|authorization|cookie|session)/i;

/**
 * Produces a summary of tool arguments that is safe to store.
 *
 * Four rules: sensitive keys lose their values entirely; long strings are
 * truncated (an audit row records what was asked, it is not a second copy
 * of the content); long arrays keep a count instead of every element; and
 * depth is capped so a pathological nested object cannot turn one audit
 * insert into a large one.
 *
 * Redacts by KEY NAME, never by inspecting the value: a heuristic that
 * tried to recognise a secret by shape would miss the first credential
 * that did not look like one.
 */
export function redactInput(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return REDACTED;
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}…(${value.length} chars)`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) {
      return [
        ...value.slice(0, MAX_ARRAY).map((item) => redactInput(item, depth + 1)),
        `…${value.length - MAX_ARRAY} more`,
      ];
    }
    return value.map((item) => redactInput(item, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactInput(item, depth + 1);
    }
    return out;
  }

  // Functions, symbols, bigints — nothing a validated tool argument can be.
  return REDACTED;
}

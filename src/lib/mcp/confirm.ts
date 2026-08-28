import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * NO PROJECT IMPORTS on purpose — the established rule in this repository
 * (see lib/auth/permissions.ts, lib/ai/guardrails.ts, lib/email/render.ts).
 * `scripts/test-mcp.mjs` imports this `.ts` directly under Node's type
 * stripping, where `@/...` aliases do not resolve, and signature logic is
 * exactly the kind of thing that must be testable without standing up an
 * HTTP server and a database.
 *
 * That is why `isConfirmationConfigured()` exists rather than this file
 * throwing an McpError: the error catalogue imports the logger, which
 * imports nothing testable. The caller does the throwing.
 */

/**
 * Confirmation tokens for high-risk actions (Master Build Plan 12B.6).
 *
 * The rule this implements: an action must not happen merely because the
 * AI interpreted a sentence. A high-risk call arrives without a token,
 * executes NOTHING, and comes back describing what it would do plus a
 * token. Only a second call carrying that token runs the action.
 *
 * BOUND TO TOOL + ARGUMENTS + ACTOR. The signature covers all three, so a
 * token issued for "archive these 24 products" cannot be replayed to
 * archive a different set, cannot be used on another tool, and cannot be
 * used by a different admin who happened to see it. Confirming is
 * confirming THAT ACTION, not saying "yes" in the abstract — which is the
 * failure mode a plain `confirmed: true` boolean would have, since a model
 * can set a boolean by itself.
 *
 * STATELESS on purpose: no table, no migration, and nothing to purge.
 * The honest cost is recorded in section 12B.14 — a token is
 * single-ACTION but not single-USE, so within its 5-minute life the same
 * confirmed action could be executed twice. The replay ledger arrives in
 * Module 38 alongside the first genuinely destructive tools; until then no
 * high-risk tool exists to replay.
 */

const TTL_MS = 5 * 60 * 1000;

/**
 * Follows the precedent in lib/security/rate-limit.ts, which salts with
 * the service-role key. A dedicated secret is preferred where one is set;
 * either way the value never leaves the server.
 *
 * FAILS CLOSED. With no secret available we cannot sign, and signing with
 * a constant would mean anyone could mint a confirmation — so the tool
 * refuses instead.
 */
function secret(): string {
  const value = process.env.MCP_CONFIRMATION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("mcp: no confirmation secret configured");
  return value;
}

/**
 * Whether high-risk actions can be confirmed at all.
 *
 * Checked by the dispatcher BEFORE it offers a confirmation, so a
 * deployment missing the secret refuses the action with a clear message
 * instead of minting tokens nobody can verify.
 */
export function isConfirmationConfigured(): boolean {
  return !!(process.env.MCP_CONFIRMATION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Stable stringification, so `{a:1,b:2}` and `{b:2,a:1}` produce the same
 * signature. Without it, a client that serialises its object in a
 * different key order would find its own valid token rejected.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

export type ConfirmationSubject = {
  toolName: string;
  /** The validated arguments, with any `confirmationToken` already removed. */
  args: unknown;
  actorId: string;
};

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function payloadFor(subject: ConfirmationSubject, expiresAt: number): string {
  return [subject.toolName, subject.actorId, String(expiresAt), canonicalize(subject.args)].join("\n");
}

/** Issues a token for exactly this tool, these arguments and this actor. */
export function createConfirmationToken(subject: ConfirmationSubject, now = Date.now()): string {
  const expiresAt = now + TTL_MS;
  return `${expiresAt}.${sign(payloadFor(subject, expiresAt))}`;
}

export type ConfirmationCheck =
  | { valid: true }
  | { valid: false; reason: "malformed" | "expired" | "mismatch" };

/**
 * Verifies a token against the action being attempted.
 *
 * A mismatch and a forgery are indistinguishable here, deliberately: both
 * mean "this token does not authorise this action", and the caller treats
 * them identically rather than telling an attacker which part was wrong.
 */
export function verifyConfirmationToken(
  token: string,
  subject: ConfirmationSubject,
  now = Date.now()
): ConfirmationCheck {
  const separator = token.indexOf(".");
  if (separator <= 0) return { valid: false, reason: "malformed" };

  const expiresAt = Number(token.slice(0, separator));
  const provided = token.slice(separator + 1);
  if (!Number.isFinite(expiresAt) || !provided) return { valid: false, reason: "malformed" };

  // Expiry is checked BEFORE the signature comparison so an expired token
  // reports honestly as expired rather than as a mismatch.
  if (now > expiresAt) return { valid: false, reason: "expired" };

  const expected = sign(payloadFor(subject, expiresAt));
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Length is compared first because timingSafeEqual throws on unequal
  // lengths; the length of an HMAC is not a secret.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "mismatch" };
  }
  return { valid: true };
}

/** How long a freshly issued token remains valid, for the caller's message. */
export const CONFIRMATION_TTL_SECONDS = TTL_MS / 1000;

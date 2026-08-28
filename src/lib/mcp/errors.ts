import { logger } from "@/lib/logger";

/**
 * The controlled error catalogue (Master Build Plan section 12B.8).
 *
 * DENY BY DEFAULT is the whole design. `toMcpError()` recognises a small
 * set of known failure shapes and maps everything else to INTERNAL_ERROR
 * with a fixed, generic message. A new failure mode therefore cannot leak
 * anything by virtue of nobody having handled it yet — the only way to
 * surface detail to the caller is to add an explicit mapping here.
 *
 * WHAT MUST NEVER REACH THE AI OR THE USER: stack traces, SQL text,
 * Postgres error codes, table or column names, connection strings,
 * environment variable names or values, internal URLs, or a raw
 * PostgrestError message. Those go to the server log via `logger`, which
 * is where an engineer can read them and a caller cannot.
 */

export const MCP_ERROR_CODES = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "BUSINESS_RULE_ERROR",
  "CONFIRMATION_REQUIRED",
  "RATE_LIMITED",
  "INTEGRATION_ERROR",
  "INTERNAL_ERROR",
] as const;

export type McpErrorCode = (typeof MCP_ERROR_CODES)[number];

/** The default user-facing text for each code. Safe to show a human. */
const DEFAULT_MESSAGES: Record<McpErrorCode, string> = {
  UNAUTHORIZED: "You need to be signed in to use this.",
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "That record could not be found.",
  VALIDATION_ERROR: "The request was not valid.",
  CONFLICT: "That conflicts with a record that already exists.",
  BUSINESS_RULE_ERROR: "That isn't allowed by the current business rules.",
  CONFIRMATION_REQUIRED: "This action needs to be confirmed before it can run.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  INTEGRATION_ERROR: "An external service didn't respond as expected.",
  INTERNAL_ERROR: "Something went wrong at our end. No changes were made.",
};

export class McpError extends Error {
  readonly code: McpErrorCode;
  /** Structured, already-safe extra detail (e.g. which fields failed validation). */
  readonly details?: unknown;

  constructor(code: McpErrorCode, message?: string, details?: unknown) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "McpError";
    this.code = code;
    this.details = details;
  }
}

export function mcpError(code: McpErrorCode, message?: string, details?: unknown): McpError {
  return new McpError(code, message, details);
}

/** A PostgrestError-shaped object, without importing supabase-js types. */
function postgrestCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Maps Postgres/PostgREST failures onto the catalogue.
 *
 * The mapping is by CODE only — never by message text — because the
 * message is where table names, column names and row values live, and a
 * substring match would be one upstream wording change away from either
 * breaking or leaking.
 *
 * 42501 is the one that matters most: it is what RLS returns when a
 * policy refuses the caller, and it must read as FORBIDDEN rather than
 * as an internal fault, so an authorization refusal is never dressed up
 * as a server bug.
 */
const PG_CODE_MAP: Record<string, McpErrorCode> = {
  "42501": "FORBIDDEN", // insufficient_privilege — an RLS policy refused
  "23505": "CONFLICT", // unique_violation
  "23503": "BUSINESS_RULE_ERROR", // foreign_key_violation
  "23502": "VALIDATION_ERROR", // not_null_violation
  "23514": "BUSINESS_RULE_ERROR", // check_violation
  "22P02": "VALIDATION_ERROR", // invalid_text_representation (e.g. a malformed uuid)
  PGRST116: "NOT_FOUND", // .single() matched no rows
  PGRST301: "UNAUTHORIZED", // JWT expired or invalid
};

/**
 * Normalises anything thrown on the tool path into a safe McpError, and
 * logs the real cause server-side.
 *
 * `context` identifies where it came from (usually the tool name) so the
 * server log line is actionable; it is never returned to the caller.
 */
export function toMcpError(error: unknown, context: string): McpError {
  if (error instanceof McpError) return error;

  const pgCode = postgrestCode(error);
  if (pgCode && PG_CODE_MAP[pgCode]) {
    logger.warn("mcp tool failed with a database error", { context, pgCode });
    return new McpError(PG_CODE_MAP[pgCode]!);
  }

  // Everything else. The real error goes to the log; the caller gets the
  // fixed sentence and nothing derived from the exception.
  logger.error("mcp tool failed", error, { context });
  return new McpError("INTERNAL_ERROR");
}

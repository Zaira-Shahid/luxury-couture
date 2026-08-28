import { z } from "zod";

import type { ReaderOptions } from "@/lib/supabase/reader";

import type { McpContext } from "../context";

/**
 * What every Module 37 read tool passes to a reader.
 *
 * Both fields matter and neither is optional in practice:
 *
 *  - `client` is the CALLER'S client. The readers build their own from
 *    request COOKIES when none is given, and an MCP call arriving over
 *    the Bearer transport carries no auth cookie — so a tool that let a
 *    reader do that would query anonymously, RLS would filter every row,
 *    and the tool would answer "no orders" to a super-admin. A silent
 *    wrong answer is worse than a refusal, which is why this helper
 *    exists rather than each handler remembering.
 *
 *  - `throwOnError` turns a swallowed query failure back into an error.
 *    The readers log and return `[]` so a page degrades gracefully; a
 *    tool must not, because "you have no pending orders" would be relayed
 *    as fact when the truth is that the query broke (12B.8).
 */
export function readerOptions(ctx: McpContext): ReaderOptions {
  return { client: ctx.supabase, throwOnError: true };
}

/**
 * A record id. Validated as a uuid so a malformed one is a clean
 * VALIDATION_ERROR from the schema rather than a 22P02 from Postgres —
 * the model gets a usable correction instead of a generic failure.
 */
export function uuid(description: string) {
  return z.string().uuid().describe(description);
}

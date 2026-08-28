import type { SupabaseClient } from "@supabase/supabase-js";

// Relative imports, and `./server` is loaded lazily inside
// `readerClient()` rather than at module scope. `./server` pulls in
// `next/headers`, which only resolves inside a request — importing it
// eagerly would make this module unloadable from a plain-node test
// script, and `readFailed()`'s behaviour (Master Build Plan 12B.8: a
// failed read must never be reported as an empty success) is exactly the
// thing that needs a direct unit assertion.
import { logger } from "@/lib/logger";

/**
 * How a reader gets its database handle, and what it does when the query
 * fails. Added in Module 37, when the MCP read tools became the first
 * caller of these readers that is not a page render.
 *
 * Both fields exist because a reader now serves two callers with opposite
 * requirements:
 *
 *  - A PAGE wants the request's cookie session and graceful degradation.
 *    A failed sidebar query should not blank the screen, so the reader
 *    logs and returns an empty result. That is the existing behaviour and
 *    it does not change: omit `options` and everything behaves exactly as
 *    it did before this module.
 *
 *  - An MCP TOOL must use the CALLER'S client, and must never turn a
 *    failure into an empty success.
 */
export type ReaderOptions = {
  /**
   * The Supabase client to query with. Omitted, the reader builds one
   * from the request cookies as it always has.
   *
   * MCP passes `ctx.supabase` here, and it is not optional politeness:
   * `createClient()` reads COOKIES, and an MCP call arriving over the
   * Bearer transport carries no auth cookie. A reader that ignored this
   * would run anonymously, RLS would filter every row, and the tool would
   * answer "no orders" to a super-admin — a silent wrong answer, which is
   * worse than a refusal.
   */
  client?: SupabaseClient;
  /**
   * Throw the underlying error instead of logging it and returning a
   * fallback.
   *
   * Master Build Plan 12B.8: "Never report success for an operation that
   * failed." A page can afford to render an empty list when a query
   * breaks; a tool cannot, because an assistant would relay "you have no
   * pending orders" as fact when the truth is "the query failed". The
   * thrown PostgrestError is mapped by `toMcpError()`, which already
   * turns 42501 into FORBIDDEN and everything unrecognised into a generic
   * INTERNAL_ERROR, so no database detail reaches the caller.
   */
  throwOnError?: boolean;
};

/** The caller's client when one was supplied, otherwise the cookie session. */
export async function readerClient(options?: ReaderOptions): Promise<SupabaseClient> {
  if (options?.client) return options.client;
  const { createClient } = await import("./server");
  return (await createClient()) as unknown as SupabaseClient;
}

/**
 * What a reader does with a query error: throw for a tool, log and fall
 * back for a page. Centralised so the two behaviours cannot drift apart
 * across the fourteen readers that now take `ReaderOptions`.
 */
export function readFailed<T>(
  error: unknown,
  options: ReaderOptions | undefined,
  fallback: T,
  message: string,
  meta?: Record<string, unknown>
): T {
  if (options?.throwOnError) throw error;
  logger.warn(message, {
    ...meta,
    message: (error as { message?: string } | null)?.message,
  });
  return fallback;
}

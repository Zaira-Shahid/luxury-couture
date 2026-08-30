import { readFailed, readerClient, type ReaderOptions } from "@/lib/supabase/reader";

/**
 * Reads for the assistant activity screen (Module 43).
 *
 * A READER, not a query in the page, following the rule Modules 39-42
 * each had to learn once: the tool that will eventually answer "how is
 * the assistant doing" must call the same code the screen calls, or
 * there are two answers to one question. Nothing calls these from a tool
 * yet — but `ReaderOptions` is honoured from the start, because retro-
 * fitting it is the part that gets forgotten.
 *
 * The aggregates go through the RPCs in 0065 rather than pulling buckets
 * into JavaScript. That is the opposite of the choice Module 41 made for
 * the commercial figures, and deliberately so: those sum a bounded set
 * of orders, while this would sum one row per tool per hour for every
 * hour in the window, which grows without limit as the deployment ages.
 */

export type McpToolStat = {
  toolName: string;
  calls: number;
  failures: number;
  confirmations: number;
  avgDurationMs: number | null;
};

export type McpFailureCount = { errorCode: string; failures: number };

export type McpFailureRow = {
  id: string;
  occurredAt: string;
  toolName: string;
  actorId: string | null;
  actorRole: string | null;
  errorCode: string;
  input: unknown;
  durationMs: number | null;
};

/** Per-tool totals over a window, worst failure count first. */
export async function getMcpToolStats(
  range: { from: Date; to: Date },
  options?: ReaderOptions
): Promise<McpToolStat[]> {
  const supabase = await readerClient(options);
  const { data, error } = await supabase.rpc("get_mcp_tool_stats", {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
  });

  if (error) return readFailed(error, options, [], "failed to load mcp tool stats");

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    toolName: String(row.tool_name),
    calls: Number(row.calls ?? 0),
    failures: Number(row.failures ?? 0),
    confirmations: Number(row.confirmations ?? 0),
    avgDurationMs: row.avg_duration_ms === null ? null : Number(row.avg_duration_ms),
  }));
}

/** Failures grouped by error code — a permission refusal and a broken query are different problems. */
export async function getMcpFailureSummary(
  range: { from: Date; to: Date },
  options?: ReaderOptions
): Promise<McpFailureCount[]> {
  const supabase = await readerClient(options);
  const { data, error } = await supabase.rpc("get_mcp_failure_summary", {
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
  });

  if (error) return readFailed(error, options, [], "failed to load mcp failure summary");

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    errorCode: String(row.error_code),
    failures: Number(row.failures ?? 0),
  }));
}

/**
 * The most recent refusals, newest first.
 *
 * Capped by the caller, and the cap is not optional politeness: this
 * table holds one row per refused call and an uncapped select would
 * grow into the page as the deployment ages.
 */
export async function getMcpRecentFailures(
  params: { limit: number; since: Date },
  options?: ReaderOptions
): Promise<McpFailureRow[]> {
  const supabase = await readerClient(options);
  const { data, error } = await supabase
    .from("mcp_tool_failures")
    .select("id, occurred_at, tool_name, actor_id, actor_role, error_code, input, duration_ms")
    .gte("occurred_at", params.since.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(params.limit);

  if (error) return readFailed(error, options, [], "failed to load mcp failures");

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    occurredAt: String(row.occurred_at),
    toolName: String(row.tool_name),
    actorId: row.actor_id ? String(row.actor_id) : null,
    actorRole: row.actor_role ? String(row.actor_role) : null,
    errorCode: String(row.error_code),
    input: row.input ?? null,
    durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
  }));
}

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * General-purpose rate limiting for public write endpoints.
 *
 * MODULE 29 FINDING: only `/api/chat` and `/api/analytics` were limited.
 * The contact/enquiry form, consultation booking and newsletter signup
 * were all anonymous, unlimited, and each one writes a database row and
 * sends an email — so a trivial loop meant unbounded rows plus outbound
 * mail from this domain, which is a deliverability problem as much as a
 * database one.
 *
 * Generalised from `lib/chat/rate-limit.ts` rather than written afresh,
 * and it reuses the same `chat_rate_limits` table: the storage shape
 * (hashed key, window start, count) is identical, and a second table
 * would mean a second thing to purge and a second place for this logic
 * to drift. The table has NO RLS policies at all (0049) — deny by
 * default — which is why this uses the service-role client.
 *
 * BACKED BY A TABLE, NOT MEMORY, and that is the point: serverless
 * instances do not share memory, so an in-process counter resets on
 * every cold start and enforces nothing in production.
 *
 * HONEST LIMITS. This throttles casual abuse and scripted floods from
 * one source. It is not a defence against a distributed attack from many
 * addresses, and it is not a CAPTCHA. Both of those are a different tier
 * of control and neither is claimed here.
 */

const WINDOW_MS = 10 * 60 * 1000;

export type RateLimitOutcome = { allowed: true } | { allowed: false; message: string };

/**
 * An IP is personal data under UK GDPR and we only ever need to
 * recognise a repeat caller, never identify one — so only a salted hash
 * is stored, never the address.
 */
function hashKey(scope: string, value: string): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`${scope}:${value}:${salt}`).digest("hex");
}

/** Best-effort client IP from the usual proxy headers. */
async function clientIp(): Promise<string> {
  try {
    const headerList = await headers();
    const forwarded = headerList.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]!.trim();
    return headerList.get("x-real-ip") ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Consumes one unit against `scope` for the calling IP.
 *
 * FAILS OPEN. If the limiter itself errors, the request is allowed. A
 * customer being unable to send an enquiry because a counter table was
 * briefly unavailable is a worse outcome than one unthrottled request,
 * and the failure is logged so a broken limiter does not stay invisible.
 */
export async function checkRateLimit(
  scope: string,
  limit: number,
  friendlyMessage: string,
  /**
   * What to count against, when the IP is the wrong unit.
   *
   * Added in Module 36 for MCP, where the caller is an authenticated
   * member of staff: counting by user id rather than by address means one
   * admin's runaway assistant loop cannot throttle a colleague sharing the
   * office connection, and cannot be sidestepped by changing address.
   * Omitted everywhere else, so the public forms keep their IP behaviour
   * unchanged.
   */
  identity?: string
): Promise<RateLimitOutcome> {
  try {
    const subject = identity ?? (await clientIp());
    // An unresolvable IP would otherwise put every such caller into one
    // shared bucket and throttle them collectively.
    if (subject === "unknown") return { allowed: true };

    const keyHash = hashKey(scope, subject);
    const admin = createAdminClient();
    const now = Date.now();

    const { data: existing } = await admin
      .from("chat_rate_limits")
      .select("window_started_at, request_count")
      .eq("key_hash", keyHash)
      .maybeSingle();

    const windowStart = existing ? new Date(existing.window_started_at as string).getTime() : 0;
    if (!existing || now - windowStart > WINDOW_MS) {
      await admin.from("chat_rate_limits").upsert(
        {
          key_hash: keyHash,
          window_started_at: new Date(now).toISOString(),
          request_count: 1,
          updated_at: new Date(now).toISOString(),
        },
        { onConflict: "key_hash" }
      );
      return { allowed: true };
    }

    const count = Number(existing.request_count ?? 0);
    if (count >= limit) return { allowed: false, message: friendlyMessage };

    await admin
      .from("chat_rate_limits")
      .update({ request_count: count + 1, updated_at: new Date(now).toISOString() })
      .eq("key_hash", keyHash);

    return { allowed: true };
  } catch (error) {
    logger.warn("rate limit check failed — allowing the request", {
      scope,
      message: error instanceof Error ? error.message : String(error),
    });
    return { allowed: true };
  }
}

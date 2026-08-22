import { createHash } from "node:crypto";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate limiting for the public chat endpoint.
 *
 * This is the first rate limiting in the project. /api/analytics shipped
 * without it (flagged for Module 29) and that was defensible: an abusive
 * burst there costs a few database rows. The chat endpoint is a different
 * risk class — with ANTHROPIC_API_KEY set, every anonymous request spends
 * real money, so shipping it unlimited would be shipping a live cost
 * exposure.
 *
 * It is checked BEFORE any provider call, so a flood is refused for the
 * price of one indexed upsert rather than an API request.
 *
 * Storage is a table, not memory: serverless instances don't share
 * memory, so an in-process counter would reset on every cold start and
 * enforce nothing in production.
 *
 * Uses the service-role client because `chat_rate_limits` has NO RLS
 * policies at all (0049) — deny-by-default, since a visitor has no
 * business reading or editing counters.
 */

/** Per conversation session. Generous enough for real use, tight enough to stop a script. */
const SESSION_LIMIT = 12;
/** Per client IP, catching someone rotating session ids. */
const IP_LIMIT = 40;
const WINDOW_MS = 5 * 60 * 1000;

export type RateLimitResult = {
  allowed: boolean;
  /** Friendly, customer-facing. Never an error code — this is a chat UI. */
  message?: string;
  retryAfterSeconds?: number;
};

/**
 * An IP is personal data under UK GDPR, and a session id is a persistent
 * identifier. We only need to recognise a repeat caller, never identify
 * one, so only a salted hash is stored.
 */
function hashKey(prefix: string, value: string): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`${prefix}:${value}:${salt}`).digest("hex");
}

/** Best-effort client IP from the usual proxy headers. */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

async function consume(keyHash: string, limit: number): Promise<boolean> {
  const admin = createAdminClient();
  const now = Date.now();

  const { data: existing } = await admin
    .from("chat_rate_limits")
    .select("window_started_at, request_count")
    .eq("key_hash", keyHash)
    .maybeSingle();

  const windowStart = existing ? new Date(existing.window_started_at as string).getTime() : 0;
  const windowExpired = !existing || now - windowStart > WINDOW_MS;

  if (windowExpired) {
    await admin.from("chat_rate_limits").upsert(
      {
        key_hash: keyHash,
        window_started_at: new Date(now).toISOString(),
        request_count: 1,
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: "key_hash" }
    );
    return true;
  }

  const count = Number(existing.request_count ?? 0);
  if (count >= limit) return false;

  await admin
    .from("chat_rate_limits")
    .update({ request_count: count + 1, updated_at: new Date(now).toISOString() })
    .eq("key_hash", keyHash);

  return true;
}

export async function checkChatRateLimit(params: {
  sessionId: string;
  ip: string;
}): Promise<RateLimitResult> {
  try {
    const sessionOk = await consume(hashKey("session", params.sessionId), SESSION_LIMIT);
    if (!sessionOk) {
      return {
        allowed: false,
        message:
          "You've sent quite a few messages in a short space of time. Please give me a few minutes, or use the contact form and a member of our team will reply.",
        retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
      };
    }

    const ipOk = await consume(hashKey("ip", params.ip), IP_LIMIT);
    if (!ipOk) {
      return {
        allowed: false,
        message:
          "We're getting a lot of messages from your connection right now. Please try again shortly, or use the contact form.",
        retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
      };
    }

    return { allowed: true };
  } catch (error) {
    // FAIL CLOSED. If the limiter itself is broken we cannot tell a real
    // customer from a flood, and the downside is asymmetric: a refused
    // message is an inconvenience, an unlimited endpoint that spends
    // money on every request is not.
    logger.error("chat rate limit check failed — refusing request", error);
    return {
      allowed: false,
      message:
        "I'm having trouble right now. Please use the contact form and our team will get back to you.",
    };
  }
}

/** Housekeeping for the retention cron: drop windows that can no longer matter. */
export const RATE_LIMIT_WINDOW_MS = WINDOW_MS;

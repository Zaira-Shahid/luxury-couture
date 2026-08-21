import { type NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GDPR storage limitation: raw analytics events are not kept forever.
 *
 * 14 months matches Google Analytics' own default retention and is the
 * shortest window that still allows a full year-over-year comparison —
 * which matters for a bridal business, where demand is strongly seasonal.
 *
 * Vercel Cron-triggered monthly (vercel.json), authorized with the same
 * CRON_SECRET bearer check as /api/cron/abandon-carts. As there: if
 * CRON_SECRET is unset the check is skipped, matching this project's
 * "unset = not configured yet" tolerance — but it MUST be set before any
 * real deploy, since this endpoint deletes data.
 */
const RETENTION_MONTHS = 14;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

  const admin = createAdminClient();
  // Service role, because analytics_events has no DELETE policy at all —
  // not even for admins. Purging is a scheduled system job, not something
  // a signed-in staff member should be able to trigger by hand.
  const { data, error } = await admin
    .from("analytics_events")
    .delete()
    .lt("occurred_at", cutoff.toISOString())
    .select("id");

  if (error) {
    logger.error("purge-analytics cron failed", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  const deleted = data?.length ?? 0;
  logger.info("purge-analytics cron complete", { deleted, cutoff: cutoff.toISOString() });
  return NextResponse.json({ deleted, cutoff: cutoff.toISOString() });
}

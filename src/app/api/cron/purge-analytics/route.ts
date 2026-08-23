import { type NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { authorizeCron } from "@/lib/security/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GDPR storage limitation: raw analytics events are not kept forever.
 *
 * 14 months matches Google Analytics' own default retention and is the
 * shortest window that still allows a full year-over-year comparison —
 * which matters for a bridal business, where demand is strongly seasonal.
 *
 * Vercel Cron-triggered monthly (vercel.json), authorized through
 * authorizeCron(), which as of Module 29 FAILS CLOSED in production
 * rather than skipping the check when CRON_SECRET is unset.
 *
 * MODULE 29 also gives this route a second job: reaping stale anonymous
 * carts. It lives here rather than in its own route because both are
 * "delete rows nobody needs any more" housekeeping on the same schedule,
 * and a third cron endpoint is a third thing to secure and monitor for
 * no gain.
 */
const RETENTION_MONTHS = 14;
/** Long enough that a session left open overnight is never disturbed. */
const STALE_CART_HOURS = 72;

export async function GET(request: NextRequest) {
  // MODULE 29: fails CLOSED in production. This used to skip the
  // check entirely when CRON_SECRET was unset, which made the route
  // publicly callable. See lib/security/cron-auth.ts.
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;

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
    // MODULE 29: reap anonymous carts that never became anything.
  //
  // Middleware writes a carts row for every visitor session, so this
  // table grows with page views rather than with orders. reap_stale_carts
  // deletes only rows that are ownerless AND still 'active' AND empty AND
  // older than the cutoff — see 0058 for why all four conditions are
  // required. A guest cart with items in it is a sales lead and is never
  // touched.
  let cartsReaped = 0;
  const { data: reaped, error: reapError } = await admin.rpc("reap_stale_carts", {
    p_older_than_hours: STALE_CART_HOURS,
  });
  if (reapError) {
    // Logged, not fatal: the analytics purge above already succeeded and
    // reporting a total failure would misdescribe what happened.
    logger.error("stale cart reap failed", reapError);
  } else {
    cartsReaped = Number(reaped ?? 0);
  }

  logger.info("purge-analytics cron complete", { deleted, cartsReaped, cutoff: cutoff.toISOString() });
  return NextResponse.json({ deleted, cartsReaped, cutoff: cutoff.toISOString() });
}

import { type NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { siteConfig } from "@/lib/config/site";
import { abandonedCartTemplate } from "@/lib/notifications/templates";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";

const ABANDON_AFTER_HOURS = 24;

/**
 * Vercel Cron-triggered (vercel.json, daily — the Hobby-tier limit, and
 * "free development implementation first" is this module's own framing).
 * This is this project's first scheduled-task mechanism of any kind — no
 * cron/queue infrastructure existed anywhere before this route.
 *
 * Authorization: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
 * when CRON_SECRET is configured (https://vercel.com/docs/cron-jobs) —
 * checked the same way the Stripe webhook checks its own secret, so this
 * privileged endpoint can't be triggered by an arbitrary request. If
 * CRON_SECRET isn't set, the check is skipped — matching this project's
 * existing "unset = not configured yet" tolerance elsewhere (e.g.
 * isStripeConfigured()), but this MUST be set before any real deploy.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const { data: abandoned, error } = await admin.rpc("find_and_mark_abandoned_carts", {
    p_hours: ABANDON_AFTER_HOURS,
  });

  if (error) {
    logger.error("abandon-carts cron failed", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  const rows = (abandoned ?? []) as { cart_id: string; customer_id: string | null }[];
  let notified = 0;

  for (const row of rows) {
    if (!row.customer_id) continue; // guest cart — no capturable contact info anywhere in the schema
    const { data: authUser } = await admin.auth.admin.getUserById(row.customer_id);
    if (!authUser?.user?.email) continue;

    await notify(admin, {
      profileId: row.customer_id,
      email: authUser.user.email,
      ...abandonedCartTemplate(siteConfig.url),
    });
    notified += 1;
  }

  return NextResponse.json({ abandoned: rows.length, notified });
}

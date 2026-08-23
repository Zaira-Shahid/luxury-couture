import { type NextRequest, NextResponse } from "next/server";

import { emailUrl } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";
import { abandonedCartEmail } from "@/lib/email/templates";
import { logger } from "@/lib/logger";
import { authorizeCron } from "@/lib/security/cron-auth";
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
  // MODULE 29: fails CLOSED in production. This used to skip the
  // check entirely when CRON_SECRET was unset, which made the route
  // publicly callable. See lib/security/cron-auth.ts.
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;

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

    // MODULE 24: an abandoned-cart email is MARKETING, not transactional
    // — a promotional nudge, not a record of something the customer did.
    // It therefore needs an opt-out check and an unsubscribe link, which
    // this previously sent without. The in-app notification still goes
    // through notify(); only the email path changed.
    const { data: profile } = await admin
      .from("profiles")
      .select("marketing_opt_out, marketing_unsubscribe_token, full_name")
      .eq("id", row.customer_id)
      .maybeSingle();

    // Fail closed: no profile row means we cannot confirm consent.
    if (!profile || profile.marketing_opt_out) continue;

    await notify(admin, {
      profileId: row.customer_id,
      // Email suppressed here on purpose — sent below through the
      // marketing path so it carries an unsubscribe link.
      email: null,
      ...abandonedCartTemplate(siteConfig.url),
    });

    await sendEmail(
      await abandonedCartEmail(
        authUser.user.email,
        (profile.full_name as string | null) ?? null,
        emailUrl(`/unsubscribe?token=${profile.marketing_unsubscribe_token}`)
      )
    );
    notified += 1;
  }

  return NextResponse.json({ abandoned: rows.length, notified });
}

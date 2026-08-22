import type { SupabaseClient } from "@supabase/supabase-js";

import { buildTransactionalEmail, getEmailBrand } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { logger } from "@/lib/logger";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

import { sendMockWhatsApp } from "./mock-channels";

export type NotifyParams = {
  /** Signed-in recipient — omit for a guest (no account, no in-app inbox). */
  profileId?: string | null;
  email?: string | null;
  phone?: string | null;
  type: string;
  title: string;
  body: string;
};

/**
 * Central notification dispatch (Master Build Plan §15). Accepts an
 * already-instantiated Supabase client rather than creating its own —
 * call sites span three different contexts (the regular RLS-respecting
 * client in Server Actions, the service-role client inside the Stripe
 * webhook route, and the DB trigger for "account created", which never
 * goes through this function at all since triggers can't call app code).
 *
 * The in-app row is only inserted when profileId is present — a guest
 * enquiry has no account to attach one to. Email still fires
 * independently whenever an address is available, so a guest still gets
 * a confirmation.
 *
 * MODULE 24: email now goes through lib/email (branded HTML + plain
 * text, real provider when configured, recorded in email_deliveries)
 * instead of a bare log line. The NotifyParams shape is unchanged on
 * purpose, so none of this function's ~16 call sites needed touching —
 * they keep passing the same {type, title, body} from
 * lib/notifications/templates.ts, which stays the single source of copy
 * for both the in-app feed and the email.
 *
 * Everything sent from here is TRANSACTIONAL: order, payment, shipping
 * and enquiry updates. Marketing (campaigns, abandoned-cart recovery)
 * deliberately does not route through notify() — it needs an unsubscribe
 * link, which the marketing template requires and this path has no way
 * to supply.
 */
export async function notify(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  { profileId, email, phone, type, title, body }: NotifyParams
): Promise<{ inAppSuccess: boolean }> {
  let inAppSuccess = true;

  if (profileId) {
    const { error } = await supabase.from("notifications").insert({
      profile_id: profileId,
      type,
      title,
      body,
      channel: "in_app",
    });
    if (error) {
      logger.warn("notify: in-app insert failed", { message: error.message, type, profileId });
      inAppSuccess = false;
    }
  }

  if (email) {
    try {
      // Module 25: an admin can switch order/payment emails off. The
      // in-app notification above still fires, so the customer is never
      // left with no record at all.
      const settings = await getSiteSettings();
      if (!settings.notifications.orderEmailsEnabled) return { inAppSuccess };

      const brand = await getEmailBrand();
      const rendered = buildTransactionalEmail(brand, {
        heading: title,
        paragraphs: [body],
      });
      await sendEmail({
        kind: "transactional",
        to: email,
        subject: title,
        templateKey: type,
        ...rendered,
      });
    } catch (error) {
      // Never let an email problem affect the operation that triggered
      // it — the order is still placed, the payment still recorded.
      logger.warn("notify: email failed", {
        message: error instanceof Error ? error.message : String(error),
        type,
      });
    }
  }

  if (phone) sendMockWhatsApp(phone, body);

  return { inAppSuccess };
}

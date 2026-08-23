import type { SupabaseClient } from "@supabase/supabase-js";

import { buildTransactionalEmail, getEmailBrand } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { logger } from "@/lib/logger";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

import { categoryForType, linkForNotification } from "./categories";
import { sendMockWhatsApp } from "./mock-channels";

export type NotifyParams = {
  /** Signed-in recipient — omit for a guest (no account, no in-app inbox). */
  profileId?: string | null;
  email?: string | null;
  phone?: string | null;
  type: string;
  title: string;
  body: string;
  /**
   * MODULE 27: the record this is about (usually an order id), used to
   * build the deep link. Optional — a notification without one still
   * files correctly, it just links to the section rather than the row.
   */
  entityId?: string | null;
  /** Overrides the derived link. Rarely needed; the derivation covers every current type. */
  link?: string | null;
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
 * MODULE 27: each notification is now filed under a category derived
 * from its type, carries a deep link to the record it is about, and
 * respects the customer's per-category EMAIL preference. The in-app row
 * is never suppressed by a preference — that feed is the customer's
 * record of what happened, and only email is the intrusive channel.
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
  { profileId, email, phone, type, title, body, entityId, link }: NotifyParams
): Promise<{ inAppSuccess: boolean }> {
  let inAppSuccess = true;

  // Module 27: derived from the `type` the caller already passes, which
  // is why none of this function's 18 call sites needed changing.
  const category = categoryForType(type);
  const resolvedLink = link ?? linkForNotification(category, entityId);

  if (profileId) {
    const { error } = await supabase.from("notifications").insert({
      profile_id: profileId,
      type,
      title,
      body,
      channel: "in_app",
      category,
      link: resolvedLink,
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
      //
      // FIXED in Module 27: this was `return { inAppSuccess }`, which
      // skipped the WhatsApp send below as well as the email. Turning off
      // order EMAILS should not silence a different channel.
      const settings = await getSiteSettings();
      if (!settings.notifications.orderEmailsEnabled) {
        if (phone) sendMockWhatsApp(phone, body);
        return { inAppSuccess };
      }

      // Module 27: the customer's own per-category email preference.
      // Checked through the SECURITY DEFINER wants_email() so it gives
      // the same answer whether this runs under a user session or the
      // service-role client in the reminder cron.
      //
      // Fails OPEN — an errored lookup returns no data, and `!== false`
      // treats that as "send". The cost of a wrongly-sent confirmation is
      // an unwanted email; the cost of a wrongly-suppressed one is a
      // customer never learning their order shipped.
      if (profileId && category) {
        const { data: wanted } = await supabase.rpc("wants_email", {
          p_profile_id: profileId,
          p_category: category,
        });
        if (wanted === false) {
          if (phone) sendMockWhatsApp(phone, body);
          return { inAppSuccess };
        }
      }

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

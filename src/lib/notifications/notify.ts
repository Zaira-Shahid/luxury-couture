import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

import { sendMockEmail, sendMockWhatsApp } from "./mock-channels";

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
 * enquiry has no account to attach one to. Mock email/WhatsApp still
 * fire independently whenever that contact info is available, so a
 * guest still gets a (mocked) confirmation.
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

  if (email) sendMockEmail(email, title, body);
  if (phone) sendMockWhatsApp(phone, body);

  return { inAppSuccess };
}

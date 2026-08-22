"use server";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { newsletterSchema } from "@/lib/validations/marketing";

export type ActionResult = { error: string } | { success: true };

export async function subscribeToNewsletter(formData: FormData): Promise<ActionResult> {
  const parsed = newsletterSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  const supabase = await createClient();
  // Plain insert, no .select(), no .upsert(): newsletter_subscribers'
  // SELECT policy is admin-only, and Postgres requires a RETURNING row to
  // also satisfy the table's SELECT policy — both .select() and .upsert()
  // (which needs RETURNING internally to report insert-vs-update status,
  // regardless of the client's return preference) would make even a
  // legitimate anonymous signup fail with a false RLS violation. A repeat
  // signup hitting the unique constraint (23505) is treated as success —
  // "already subscribed" is the desired end state, not an error.
  const { error } = await supabase
    .from("newsletter_subscribers")
    .insert({ email: parsed.data.email, source: "homepage" });

  if (error && error.code !== "23505") {
    logger.error("newsletter signup failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}

/**
 * A subscriber has no account and no RLS path to their own row (0020:
 * select/update/delete are admin-only) — unsubscribe_newsletter (0043) is
 * a security definer RPC, the same token-gated pattern as every other
 * guest-facing operation in this project. Always reports success even
 * for an unknown/already-used token, so this can't be used to probe
 * which tokens are valid.
 */
export async function unsubscribeFromNewsletter(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unsubscribe_newsletter", { p_token: token });

  if (error) {
    logger.warn("newsletter unsubscribe failed", { message: error.message });
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}

/**
 * Marketing opt-out for a customer ACCOUNT, as opposed to a newsletter
 * subscriber. Added in Module 24 because customer-segment campaigns
 * (VIP / new / at-risk) previously had no opt-out mechanism at all.
 *
 * Same shape as unsubscribeFromNewsletter: a security definer RPC (0051)
 * because the person following the link is not signed in, and profiles'
 * RLS only permits updating your own row.
 *
 * Both are called blind by the unsubscribe page — one of them matches a
 * real token and the other is a no-op, and neither reveals which. That
 * is deliberate: confirming a token's validity to an anonymous caller
 * would leak whether an account or subscription exists.
 */
export async function unsubscribeFromMarketing(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unsubscribe_marketing", { p_token: token });

  if (error) {
    logger.warn("marketing unsubscribe failed", { message: error.message });
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}

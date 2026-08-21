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

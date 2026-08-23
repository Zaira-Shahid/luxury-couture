"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import {
  NOTIFICATION_CATEGORIES,
  isNotificationCategory,
} from "@/lib/notifications/categories";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true };

/**
 * Every action here scopes its write by `profile_id = user.id` in
 * addition to the RLS policy that already does so.
 *
 * That is not redundant belt-and-braces for its own sake: RLS turns a
 * cross-user write into "zero rows affected" rather than an error, so
 * without the explicit filter a policy regression would look like a
 * successful no-op instead of a failure. The filter makes the intent
 * legible at the call site and keeps the query on the
 * (profile_id, ...) indexes.
 */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) {
    logger.error("mark notification read failed", error, { id });
    return { error: "Could not update this notification." };
  }

  revalidatePath("/account/notifications");
  revalidatePath("/account", "layout");
  return { success: true };
}

/** The undo. Without it, an accidental "mark all read" is unrecoverable. */
export async function markNotificationUnread(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: null })
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) {
    logger.error("mark notification unread failed", error, { id });
    return { error: "Could not update this notification." };
  }

  revalidatePath("/account/notifications");
  revalidatePath("/account", "layout");
  return { success: true };
}

/**
 * Marks everything unread as read, optionally within one category.
 *
 * Scoped to `read_at is null` rather than updating every row, so a
 * customer with hundreds of old notifications does not rewrite them all
 * — and so the `updated_at` of already-read rows is not disturbed.
 */
export async function markAllNotificationsRead(category?: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };

  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .is("read_at", null);

  if (category && isNotificationCategory(category)) query = query.eq("category", category);

  const { error } = await query;
  if (error) {
    logger.error("mark all notifications read failed", error, { category });
    return { error: "Could not update your notifications." };
  }

  revalidatePath("/account/notifications");
  revalidatePath("/account", "layout");
  return { success: true };
}

/**
 * Saves the per-category EMAIL preferences.
 *
 * In-app notifications are not adjustable and this action cannot switch
 * them off — see `0056_notification_center.sql` for why. The feed is the
 * customer's record of what happened; only email is the intrusive
 * channel.
 *
 * Written as an upsert over the full category list rather than a diff:
 * an unchecked checkbox submits nothing at all, so "absent" has to be
 * read as false, and that is only safe if every category is accounted for
 * on every save.
 */
export async function updateNotificationPreferences(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const enabled = new Set(formData.getAll("email").map(String));
  const rows = NOTIFICATION_CATEGORIES.map((category) => ({
    profile_id: user.id,
    category,
    email_enabled: enabled.has(category),
  }));

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(rows, { onConflict: "profile_id,category" });

  if (error) {
    logger.error("update notification preferences failed", error);
    return { error: "Could not save your preferences." };
  }

  revalidatePath("/account/notifications/preferences");
  return { success: true };
}

/**
 * The marketing opt-out, which lives on `profiles.marketing_opt_out`
 * (Module 24) rather than in `notification_preferences`.
 *
 * Kept where it is on purpose: the one-click unsubscribe link in every
 * marketing email already writes that column, and a second switch for the
 * same question would be a second source of truth. This surfaces it on
 * the preferences screen without duplicating it.
 */
export async function updateMarketingOptOut(optOut: boolean): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ marketing_opt_out: optOut })
    .eq("id", user.id);

  if (error) {
    logger.error("update marketing opt-out failed", error);
    return { error: "Could not save your preference." };
  }

  revalidatePath("/account/notifications/preferences");
  return { success: true };
}

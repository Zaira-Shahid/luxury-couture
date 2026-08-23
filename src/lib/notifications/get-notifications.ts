import { cache } from "react";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/types/database";

import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "./categories";

export const PAGE_SIZE = 20;

/**
 * Unread count for the badge.
 *
 * `head: true` with `count: "exact"` so Postgres returns the number
 * without shipping a single row — this runs on every account page render
 * and in the site header, and the partial index
 * `notifications_unread_idx (profile_id, read_at) where read_at is null`
 * exists specifically for it.
 *
 * Memoized per request: the sidebar badge and the page heading would
 * otherwise ask twice for the same number.
 *
 * Returns 0 on any error. A badge is not worth an error page, and a
 * wrong-but-quiet zero is better than a crash on a page whose actual job
 * is showing someone their orders.
 */
export const getUnreadNotificationCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .is("read_at", null);

  if (error) {
    logger.warn("unread notification count failed", { message: error.message });
    return 0;
  }
  return count ?? 0;
});

export type NotificationFeed = {
  notifications: Notification[];
  total: number;
  page: number;
  pageCount: number;
  /** Unread count per category, for the filter chips. */
  unreadByCategory: Record<string, number>;
};

/**
 * One page of the customer's feed, optionally filtered.
 *
 * RLS already restricts this to the caller's own rows, but the
 * `profile_id` filter stays explicit: relying on a policy to scope a
 * query means a policy change silently becomes a data leak, and the
 * index is on (profile_id, ...) anyway.
 */
export async function getNotificationFeed(options: {
  category?: string;
  page?: number;
  unreadOnly?: boolean;
}): Promise<NotificationFeed> {
  const empty: NotificationFeed = {
    notifications: [],
    total: 0,
    page: 1,
    pageCount: 1,
    unreadByCategory: {},
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const page = Math.max(1, options.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    // Tiebreaker, and it is load-bearing rather than cosmetic. Postgres
    // gives no guaranteed order between rows with equal sort keys, so
    // paginating on created_at alone lets a tie group reshuffle between
    // requests — the same row appears on two pages while another is
    // skipped entirely. Notifications tie routinely: `delivered` and
    // `review_request` are written back-to-back by the same action, and
    // any batch insert shares a timestamp outright.
    //
    // `id` is a random uuid, so this is not a secondary chronological
    // sort — it is an arbitrary but STABLE order within a tie group,
    // which is exactly what pagination needs. The rows are simultaneous;
    // there is no true order between them to preserve.
    .order("id", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (options.category && (NOTIFICATION_CATEGORIES as readonly string[]).includes(options.category)) {
    query = query.eq("category", options.category);
  }
  if (options.unreadOnly) query = query.is("read_at", null);

  const { data, count, error } = await query;
  if (error) {
    logger.warn("notification feed failed", { message: error.message });
    return empty;
  }

  // Counts for the filter chips. A separate narrow read of the unread
  // rows only — cheap against the partial index, and it has to ignore the
  // current filter, which is why it cannot come out of the query above.
  const { data: unreadRows } = await supabase
    .from("notifications")
    .select("category")
    .eq("profile_id", user.id)
    .is("read_at", null);

  const unreadByCategory: Record<string, number> = {};
  for (const row of (unreadRows ?? []) as { category: string | null }[]) {
    const key = row.category ?? "other";
    unreadByCategory[key] = (unreadByCategory[key] ?? 0) + 1;
  }

  const total = count ?? 0;
  return {
    notifications: (data ?? []) as Notification[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    unreadByCategory,
  };
}

/**
 * The customer's email preferences, as category -> enabled.
 *
 * An absent row means opted in, so this starts from "everything on" and
 * only turns things off. That default is the one that matters: a customer
 * who has never opened the preferences screen must keep receiving their
 * order emails.
 */
export async function getNotificationPreferences(): Promise<Record<NotificationCategory, boolean>> {
  const defaults = Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [category, true])
  ) as Record<NotificationCategory, boolean>;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return defaults;

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("category, email_enabled")
    .eq("profile_id", user.id);

  if (error) {
    logger.warn("notification preferences read failed", { message: error.message });
    return defaults;
  }

  for (const row of (data ?? []) as { category: string; email_enabled: boolean }[]) {
    if (row.category in defaults) {
      defaults[row.category as NotificationCategory] = row.email_enabled;
    }
  }
  return defaults;
}

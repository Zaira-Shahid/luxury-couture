import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CATEGORY_LABELS,
  NOTIFICATION_CATEGORIES,
  isNotificationCategory,
} from "@/lib/notifications/categories";
import { getNotificationFeed } from "@/lib/notifications/get-notifications";
import { cn } from "@/lib/utils";

import { NotificationItem } from "./notification-item";
import { MarkAllReadButton } from "./mark-all-read-button";

export const metadata: Metadata = { title: "Notifications" };

/** Rebuilds the current URL with one parameter changed, so filters compose rather than reset. */
function href(params: { category?: string; unread?: boolean; page?: number }) {
  const search = new URLSearchParams();
  if (params.category) search.set("category", params.category);
  if (params.unread) search.set("unread", "1");
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/account/notifications?${query}` : "/account/notifications";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; unread?: string; page?: string }>;
}) {
  const params = await searchParams;
  const category =
    params.category && isNotificationCategory(params.category) ? params.category : undefined;
  const unreadOnly = params.unread === "1";
  const page = Number(params.page) > 0 ? Number(params.page) : 1;

  const feed = await getNotificationFeed({ category, unreadOnly, page });
  const totalUnread = Object.values(feed.unreadByCategory).reduce((sum, n) => sum + n, 0);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            {totalUnread > 0
              ? `${totalUnread} unread ${totalUnread === 1 ? "update" : "updates"}.`
              : "You are all caught up."}
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/account/notifications/preferences"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Email preferences
          </Link>
          {totalUnread > 0 ? <MarkAllReadButton category={category} /> : null}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip href={href({ unread: unreadOnly })} active={!category} label="All" />
          {NOTIFICATION_CATEGORIES.map((value) => (
            <FilterChip
              key={value}
              href={href({ category: value, unread: unreadOnly })}
              active={category === value}
              label={CATEGORY_LABELS[value]}
              count={feed.unreadByCategory[value] ?? 0}
            />
          ))}
          <FilterChip
            href={href({ category, unread: !unreadOnly })}
            active={unreadOnly}
            label="Unread only"
          />
        </div>

        {feed.notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {unreadOnly || category
              ? "Nothing here. Try a different filter."
              : "No notifications yet. Updates about your orders will appear here."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {feed.notifications.map((n) => (
              <NotificationItem
                key={n.id}
                id={n.id}
                title={n.title}
                body={n.body}
                createdAt={n.created_at}
                isRead={!!n.read_at}
                category={n.category}
                link={n.link}
              />
            ))}
          </ul>
        )}

        {feed.pageCount > 1 ? (
          <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
            {page > 1 ? (
              <Link
                href={href({ category, unread: unreadOnly, page: page - 1 })}
                className="text-muted-foreground hover:text-foreground"
              >
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Page {page} of {feed.pageCount}
            </span>
            {page < feed.pageCount ? (
              <Link
                href={href({ category, unread: unreadOnly, page: page + 1 })}
                className="text-muted-foreground hover:text-foreground"
              >
                Older →
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FilterChip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-1 text-sm transition-colors",
        active
          ? "bg-foreground text-background"
          : "border border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      {count ? <span className="ml-1.5 text-xs">({count})</span> : null}
    </Link>
  );
}

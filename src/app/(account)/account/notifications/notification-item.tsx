"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  markNotificationRead,
  markNotificationUnread,
} from "@/features/notifications/actions";
import { CATEGORY_LABELS, isNotificationCategory } from "@/lib/notifications/categories";
import { cn } from "@/lib/utils";

export function NotificationItem({
  id,
  title,
  body,
  createdAt,
  isRead,
  category,
  link,
}: {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  isRead: boolean;
  category: string | null;
  link: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function toggleRead() {
    startTransition(async () => {
      const result = isRead
        ? await markNotificationUnread(id)
        : await markNotificationRead(id);
      if ("error" in result) toast.error(result.error);
    });
  }

  // Following the link is also the natural moment to consider it read —
  // but it is NOT marked read here. A silent side effect on navigation
  // makes "unread only" behave unpredictably, and the customer already
  // has an explicit control.
  const heading = link ? (
    <Link href={link} className="font-medium underline-offset-4 hover:underline">
      {title}
    </Link>
  ) : (
    <p className="font-medium">{title}</p>
  );

  return (
    <li
      className={cn(
        "rounded-lg border p-3 text-sm transition-colors",
        isRead ? "border-border opacity-60" : "border-foreground/20 bg-muted/30"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {!isRead ? (
              <span
                aria-label="Unread"
                className="size-1.5 shrink-0 rounded-full bg-foreground"
              />
            ) : null}
            {heading}
            {category && isNotificationCategory(category) ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {CATEGORY_LABELS[category]}
              </span>
            ) : null}
          </div>
          {body ? <p className="mt-1 text-muted-foreground">{body}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(createdAt).toLocaleString("en-GB")}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={toggleRead}
          className="shrink-0"
        >
          {isRead ? "Mark unread" : "Mark read"}
        </Button>
      </div>
    </li>
  );
}

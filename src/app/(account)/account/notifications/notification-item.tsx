"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markNotificationRead } from "@/features/notifications/actions";

export function NotificationItem({
  id,
  title,
  body,
  createdAt,
  isRead,
}: {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  isRead: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleMarkRead() {
    startTransition(async () => {
      const result = await markNotificationRead(id);
      if ("error" in result) toast.error(result.error);
    });
  }

  return (
    <li className={`rounded-lg border border-border p-3 text-sm ${isRead ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{title}</p>
          {body ? <p className="mt-1 text-muted-foreground">{body}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(createdAt).toLocaleString("en-GB")}
          </p>
        </div>
        {!isRead ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={handleMarkRead}
          >
            Mark read
          </Button>
        ) : null}
      </div>
    </li>
  );
}

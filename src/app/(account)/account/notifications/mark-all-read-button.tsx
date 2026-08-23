"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/features/notifications/actions";

/**
 * Marks the visible category read, or everything when unfiltered — the
 * label says which, so the button never clears more than it claims to.
 */
export function MarkAllReadButton({ category }: { category?: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await markAllNotificationsRead(category);
          if ("error" in result) toast.error(result.error);
          else toast.success("Marked as read.");
        })
      }
    >
      {category ? "Mark section read" : "Mark all read"}
    </Button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function DeleteButton({
  action,
  confirmMessage,
}: {
  action: () => Promise<{ error: string } | undefined>;
  confirmMessage: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{confirmMessage}</span>
        <Button
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await action();
              if (result?.error) {
                toast.error(result.error);
                setConfirming(false);
              }
            })
          }
        >
          {isPending ? "Deleting…" : "Confirm"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
      Delete
    </Button>
  );
}

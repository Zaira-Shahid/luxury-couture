"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addOrderNote } from "@/features/admin-orders/actions";
import type { OrderNote } from "@/types/database";

export function OrderNotes({ orderId, notes }: { orderId: string; notes: OrderNote[] }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addOrderNote(orderId, formData);
      if ("error" in result) toast.error(result.error);
      else toast.success("Note added.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No internal notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg bg-muted/50 p-2">
              <p>{note.note}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(note.created_at).toLocaleString("en-GB")}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form action={handleSubmit} className="flex flex-col gap-2">
        <Textarea name="note" rows={2} placeholder="Internal note (never shown to the customer)…" required />
        <Button type="submit" size="sm" disabled={isPending} className="w-fit">
          {isPending ? "Saving…" : "Add Note"}
        </Button>
      </form>
    </div>
  );
}

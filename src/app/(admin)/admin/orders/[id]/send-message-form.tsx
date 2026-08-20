"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendCustomerMessage } from "@/features/admin-orders/actions";

export function SendMessageForm({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSent(false);
    startTransition(async () => {
      const result = await sendCustomerMessage(orderId, formData);
      if ("error" in result) setError(result.error);
      else setSent(true);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body">Message</Label>
        <Textarea id="body" name="body" rows={3} required />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {sent ? <p className="text-sm text-primary">Sent to the customer.</p> : null}
      <Button type="submit" size="sm" disabled={isPending} className="w-fit">
        {isPending ? "Sending…" : "Send Message"}
      </Button>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendToProduction } from "@/features/admin-orders/actions";

export function SendToProductionForm({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await sendToProduction(orderId, formData);
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="estimatedCompletionDate">Estimated completion date (optional)</Label>
        <Input id="estimatedCompletionDate" name="estimatedCompletionDate" type="date" />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="sm" disabled={isPending} className="w-fit">
        {isPending ? "Sending…" : "Send to Production"}
      </Button>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createQuotation } from "@/features/admin-quotations/actions";

export function CreateQuotationForm({ enquiryId }: { enquiryId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createQuotation(enquiryId, formData);
      if ("error" in result) setError(result.error);
      else setCreated(true);
    });
  }

  if (created) {
    return <p className="text-sm text-primary">Quotation sent to the customer.</p>;
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">Create Quotation</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quotedPrice">Quoted price (£)</Label>
          <Input id="quotedPrice" name="quotedPrice" type="number" step="0.01" min="0" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="depositPercentage">Deposit % (optional)</Label>
          <Input id="depositPercentage" name="depositPercentage" type="number" step="1" min="0" max="100" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="validUntil">Valid until (optional)</Label>
        <Input id="validUntil" name="validUntil" type="date" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes for the customer (optional)</Label>
        <Textarea id="notes" name="notes" rows={3} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Sending…" : "Send Quotation"}
      </Button>
    </form>
  );
}

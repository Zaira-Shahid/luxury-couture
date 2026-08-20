"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bookConsultation } from "@/features/consultations/actions";
import type { ConsultationType } from "@/types/database";

export function BookingForm({ consultationTypes }: { consultationTypes: ConsultationType[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await bookConsultation(formData);
      if ("error" in result) setError(result.error);
      else setBooked(true);
    });
  }

  if (booked) {
    return (
      <p className="text-sm text-muted-foreground">
        Thank you — your consultation request has been received. We&apos;ll confirm by email shortly.
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="consultationTypeId">Consultation type</Label>
        <select
          id="consultationTypeId"
          name="consultationTypeId"
          required
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Choose one…</option>
          {consultationTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name} ({type.duration_minutes} min)
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="scheduledAt">Preferred date &amp; time</Label>
        <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
        <p className="text-xs text-muted-foreground">Between 10:00 and 18:00.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contactName">Name</Label>
          <Input id="contactName" name="contactName" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contactEmail">Email</Label>
          <Input id="contactEmail" name="contactEmail" type="email" required />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contactPhone">Phone (optional)</Label>
        <Input id="contactPhone" name="contactPhone" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={3} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Booking…" : "Request Consultation"}
      </Button>
    </form>
  );
}

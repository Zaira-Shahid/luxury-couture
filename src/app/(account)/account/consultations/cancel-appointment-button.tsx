"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cancelAppointment } from "@/features/consultations/actions";

export function CancelAppointmentButton({ appointmentId }: { appointmentId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await cancelAppointment(appointmentId);
      if ("error" in result) toast.error(result.error);
      else toast.success("Appointment cancelled.");
    });
  }

  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={handleClick}>
      {isPending ? "Cancelling…" : "Cancel"}
    </Button>
  );
}

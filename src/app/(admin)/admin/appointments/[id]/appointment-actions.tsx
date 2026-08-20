"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { updateAppointmentStatus } from "@/features/admin-consultations/actions";
import type { AppointmentStatus } from "@/types/database";

const STATUSES: { value: AppointmentStatus; label: string }[] = [
  { value: "requested", label: "Requested" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

export function AppointmentActions({
  appointmentId,
  currentStatus,
}: {
  appointmentId: string;
  currentStatus: AppointmentStatus;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(status: AppointmentStatus) {
    startTransition(async () => {
      const result = await updateAppointmentStatus(appointmentId, status);
      if ("error" in result) toast.error(result.error);
      else toast.success("Status updated.");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((status) => (
        <Button
          key={status.value}
          type="button"
          size="sm"
          variant={currentStatus === status.value ? "default" : "outline"}
          disabled={isPending}
          onClick={() => handleChange(status.value)}
        >
          {status.label}
        </Button>
      ))}
    </div>
  );
}

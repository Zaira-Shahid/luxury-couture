"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { assignEnquiryToSelf, updateEnquiryStatus } from "@/features/admin-enquiries/actions";
import type { EnquiryStatus } from "@/types/database";

const STATUSES: { value: EnquiryStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_review", label: "In review" },
  { value: "quoted", label: "Quoted" },
  { value: "closed", label: "Closed" },
];

export function EnquiryActions({
  enquiryId,
  currentStatus,
  isAssignedToMe,
}: {
  enquiryId: string;
  currentStatus: EnquiryStatus;
  isAssignedToMe: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(status: EnquiryStatus) {
    startTransition(async () => {
      const result = await updateEnquiryStatus(enquiryId, status);
      if ("error" in result) toast.error(result.error);
      else toast.success("Status updated.");
    });
  }

  function handleAssign() {
    startTransition(async () => {
      const result = await assignEnquiryToSelf(enquiryId);
      if ("error" in result) toast.error(result.error);
      else toast.success("Assigned to you.");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUSES.map((status) => (
        <Button
          key={status.value}
          type="button"
          size="sm"
          variant={currentStatus === status.value ? "default" : "outline"}
          disabled={isPending}
          onClick={() => handleStatusChange(status.value)}
        >
          {status.label}
        </Button>
      ))}
      {!isAssignedToMe ? (
        <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={handleAssign}>
          Assign to me
        </Button>
      ) : null}
    </div>
  );
}

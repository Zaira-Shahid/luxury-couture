"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProductionDetails } from "@/features/admin-production/actions";

export function DetailsForm({
  productionOrderId,
  assignedTeam,
  estimatedCompletionDate,
}: {
  productionOrderId: string;
  assignedTeam: string | null;
  estimatedCompletionDate: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateProductionDetails(productionOrderId, formData);
      if ("error" in result) toast.error(result.error);
      else toast.success("Details updated.");
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assignedTeam">Assigned team (optional)</Label>
        <Input id="assignedTeam" name="assignedTeam" defaultValue={assignedTeam ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="estimatedCompletionDate">Estimated completion date (optional)</Label>
        <Input
          id="estimatedCompletionDate"
          name="estimatedCompletionDate"
          type="date"
          defaultValue={estimatedCompletionDate ?? ""}
        />
      </div>
      <Button type="submit" size="sm" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Save Details"}
      </Button>
    </form>
  );
}

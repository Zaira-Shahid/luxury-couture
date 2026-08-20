"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { advanceProductionStatus } from "@/features/admin-production/actions";
import { PRODUCTION_STATUSES } from "@/lib/validations/production";

const STATUS_LABELS: Record<string, string> = {
  order_confirmed: "Order Confirmed",
  measurements_verified: "Measurements Verified",
  design_approved: "Design Approved",
  materials_prepared: "Materials Prepared",
  cutting: "Cutting",
  embroidery: "Embroidery",
  stitching: "Stitching",
  finishing: "Finishing",
  quality_check: "Quality Check",
  ready_for_dispatch: "Ready for Dispatch",
  shipped: "Shipped",
  delivered: "Delivered",
};

export function AdvanceStatusForm({ productionOrderId, currentStatus }: { productionOrderId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await advanceProductionStatus(productionOrderId, formData);
      if ("error" in result) toast.error(result.error);
      else toast.success("Production status updated.");
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={currentStatus}
          className="h-8 w-fit rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          {PRODUCTION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status] ?? status}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Note (optional, visible to the customer on their order timeline)</Label>
        <Textarea id="note" name="note" rows={2} />
      </div>
      <Button type="submit" size="sm" disabled={isPending} className="w-fit">
        {isPending ? "Updating…" : "Update Status"}
      </Button>
    </form>
  );
}

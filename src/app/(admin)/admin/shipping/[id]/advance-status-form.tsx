"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { advanceShippingStatus } from "@/features/admin-shipping/actions";
import { SHIPPING_STATUSES } from "@/lib/validations/shipping";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  label_created: "Label Created",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  exception: "Exception",
};

export function AdvanceStatusForm({ shippingOrderId, currentStatus }: { shippingOrderId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await advanceShippingStatus(shippingOrderId, formData);
      if ("error" in result) toast.error(result.error);
      else toast.success("Shipping status updated.");
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
          {SHIPPING_STATUSES.map((status) => (
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

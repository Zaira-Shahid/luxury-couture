"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateShippingDetails } from "@/features/admin-shipping/actions";

export function DetailsForm({
  shippingOrderId,
  courier,
  trackingNumber,
}: {
  shippingOrderId: string;
  courier: string | null;
  trackingNumber: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateShippingDetails(shippingOrderId, formData);
      if ("error" in result) toast.error(result.error);
      else toast.success("Details updated.");
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="courier">Courier</Label>
        <Input id="courier" name="courier" defaultValue={courier ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="trackingNumber">Tracking number</Label>
        <Input id="trackingNumber" name="trackingNumber" defaultValue={trackingNumber ?? ""} />
      </div>
      <Button type="submit" size="sm" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Save Details"}
      </Button>
    </form>
  );
}

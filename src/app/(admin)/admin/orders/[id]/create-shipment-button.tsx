"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createShipment } from "@/features/admin-shipping/actions";

export function CreateShipmentButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await createShipment(orderId);
      if ("error" in result) toast.error(result.error);
      else toast.success("Shipment created.");
    });
  }

  return (
    <Button type="button" size="sm" disabled={isPending} onClick={handleClick}>
      {isPending ? "Creating…" : "Create Shipment"}
    </Button>
  );
}

"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { deleteAddress } from "@/features/customers/actions";
import { Button } from "@/components/ui/button";

export function DeleteAddressButton({ addressId }: { addressId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await deleteAddress(addressId);
      if ("error" in result) toast.error(result.error);
      else toast.success("Address removed.");
    });
  }

  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={handleClick}>
      {isPending ? "Removing…" : "Remove"}
    </Button>
  );
}

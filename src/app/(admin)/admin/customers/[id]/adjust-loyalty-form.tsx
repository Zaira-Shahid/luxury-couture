"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adjustLoyaltyPoints } from "@/features/admin-loyalty/actions";

export function AdjustLoyaltyForm({ customerId }: { customerId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await adjustLoyaltyPoints(customerId, formData);
      if ("error" in result) toast.error(result.error);
      else toast.success("Points adjusted.");
    });
  }

  return (
    <form action={handleSubmit} className="flex items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="points" className="text-xs text-muted-foreground">
          Adjust points (+/-)
        </label>
        <Input id="points" name="points" type="number" step="1" className="w-32" required />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        Adjust
      </Button>
    </form>
  );
}

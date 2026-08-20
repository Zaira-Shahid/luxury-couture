"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { initiatePayment } from "@/features/payments/actions";

export function PayNowButton({ paymentId }: { paymentId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await initiatePayment(paymentId);
      // initiatePayment redirects to Stripe on success — reaching here
      // with a result at all means it didn't (an error).
      if (result && "error" in result) toast.error(result.error);
    });
  }

  return (
    <Button type="button" disabled={isPending} onClick={handleClick}>
      {isPending ? "Redirecting…" : "Pay Now"}
    </Button>
  );
}

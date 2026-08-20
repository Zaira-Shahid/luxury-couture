"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markPaymentPaidManually, refundPayment } from "@/features/admin-payments/actions";

export function PaymentRowActions({ paymentId, status }: { paymentId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  function handleMarkPaid() {
    startTransition(async () => {
      const result = await markPaymentPaidManually(paymentId);
      if ("error" in result) toast.error(result.error);
      else toast.success("Marked as paid.");
    });
  }

  function handleRefund() {
    startTransition(async () => {
      const result = await refundPayment(paymentId);
      if ("error" in result) toast.error(result.error);
      else toast.success("Refunded.");
    });
  }

  if (status === "pending") {
    return (
      <Button size="sm" variant="outline" disabled={isPending} onClick={handleMarkPaid}>
        Mark Paid
      </Button>
    );
  }
  if (status === "succeeded") {
    return (
      <Button size="sm" variant="outline" disabled={isPending} onClick={handleRefund}>
        Refund
      </Button>
    );
  }
  return null;
}

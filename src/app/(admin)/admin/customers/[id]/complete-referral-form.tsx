"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeReferral } from "@/features/admin-referrals/actions";

export function CompleteReferralForm({ referralId }: { referralId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await completeReferral(referralId, formData);
      if ("error" in result) toast.error(result.error);
      else toast.success("Referral completed.");
    });
  }

  return (
    <form action={handleSubmit} className="flex items-center gap-2">
      <Input name="rewardAmount" type="number" step="0.01" min="0" placeholder="Reward £" className="w-24" required />
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        Complete
      </Button>
    </form>
  );
}

"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { generateReferralCode } from "@/features/referrals/actions";

export function ReferralGenerateButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await generateReferralCode();
      if ("error" in result) toast.error(result.error);
    });
  }

  return (
    <Button type="button" size="sm" disabled={isPending} onClick={handleClick} className="w-fit">
      {isPending ? "Generating…" : "Generate a Referral Code"}
    </Button>
  );
}

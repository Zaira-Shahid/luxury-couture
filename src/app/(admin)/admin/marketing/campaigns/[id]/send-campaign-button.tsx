"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sendCampaign } from "@/features/admin-campaigns/actions";

export function SendCampaignButton({ campaignId }: { campaignId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await sendCampaign(campaignId);
      if (result && "error" in result) toast.error(result.error);
      else toast.success("Campaign sent.");
    });
  }

  return (
    <Button type="button" disabled={isPending} onClick={handleClick}>
      {isPending ? "Sending…" : "Send Now"}
    </Button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCampaign } from "@/features/admin-campaigns/actions";

export default function NewCampaignPage() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createCampaign(formData);
      if (result && "error" in result) {
        toast.error(result.error);
        setError(result.error);
      }
    });
  }

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="mb-6 font-heading text-2xl">New Campaign</h1>
      <form action={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" name="subject" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="body">Body</Label>
          <Textarea id="body" name="body" rows={6} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target">Target audience</Label>
          <select
            id="target"
            name="target"
            defaultValue="all_subscribers"
            className="h-8 w-fit rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="all_subscribers">All newsletter subscribers</option>
            <option value="vip_customers">VIP customers</option>
            <option value="new_customers">New customers</option>
            <option value="at_risk_customers">At-risk customers</option>
          </select>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={isPending} className="w-fit">
          {isPending ? "Saving…" : "Save Draft"}
        </Button>
      </form>
    </div>
  );
}

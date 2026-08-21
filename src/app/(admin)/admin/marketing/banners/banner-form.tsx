"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/features/admin-banners/actions";
import type { PromotionalBanner } from "@/types/database";

function toDateInputValue(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function BannerForm({
  banner,
  action,
}: {
  banner?: PromotionalBanner;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        toast.success(banner ? "Banner updated." : "Banner created.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="text">Text</Label>
        <Input id="text" name="text" defaultValue={banner?.text} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="linkUrl">Link (optional)</Label>
        <Input id="linkUrl" name="linkUrl" defaultValue={banner?.link_url ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startsAt">Starts (optional)</Label>
          <Input id="startsAt" name="startsAt" type="date" defaultValue={toDateInputValue(banner?.starts_at ?? null)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expiresAt">Expires (optional)</Label>
          <Input id="expiresAt" name="expiresAt" type="date" defaultValue={toDateInputValue(banner?.expires_at ?? null)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sortOrder">Priority (lower shows first)</Label>
          <Input id="sortOrder" name="sortOrder" type="number" defaultValue={banner?.sort_order ?? 0} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={banner?.is_active ?? true} className="size-4" />
        Active
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : banner ? "Save changes" : "Create banner"}
      </Button>
    </form>
  );
}

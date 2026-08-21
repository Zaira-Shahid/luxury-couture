"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/features/admin-coupons/actions";
import type { Coupon } from "@/types/database";

function toDateInputValue(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function CouponForm({
  coupon,
  action,
}: {
  coupon?: Coupon;
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
        toast.success(coupon ? "Coupon updated." : "Coupon created.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">Code</Label>
          <Input id="code" name="code" defaultValue={coupon?.code} required className="uppercase" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            defaultValue={coupon?.type ?? "percentage"}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="percentage">Percentage off</option>
            <option value="fixed">Fixed amount off</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="value">Value</Label>
          <Input id="value" name="value" type="number" step="0.01" min="0" defaultValue={coupon?.value ?? ""} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="minOrderAmount">Minimum order amount (optional)</Label>
          <Input id="minOrderAmount" name="minOrderAmount" type="number" step="0.01" min="0" defaultValue={coupon?.min_order_amount ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maxUses">Max uses (optional)</Label>
          <Input id="maxUses" name="maxUses" type="number" min="1" defaultValue={coupon?.max_uses ?? ""} />
        </div>
        <div />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startsAt">Starts (optional)</Label>
          <Input id="startsAt" name="startsAt" type="date" defaultValue={toDateInputValue(coupon?.starts_at ?? null)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expiresAt">Expires (optional)</Label>
          <Input id="expiresAt" name="expiresAt" type="date" defaultValue={toDateInputValue(coupon?.expires_at ?? null)} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={coupon?.is_active ?? true} className="size-4" />
        Active
      </label>

      {coupon ? (
        <p className="text-xs text-muted-foreground">Used {coupon.used_count} time{coupon.used_count === 1 ? "" : "s"}.</p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : coupon ? "Save changes" : "Create coupon"}
      </Button>
    </form>
  );
}

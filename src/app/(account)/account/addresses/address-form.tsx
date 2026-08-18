"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createAddress } from "@/features/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddressForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createAddress(formData);
      if ("error" in result) {
        setError(result.error);
      } else {
        toast.success("Address added.");
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="grid max-w-lg gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="label">Label (optional)</Label>
        <Input id="label" name="label" placeholder="Home, Studio…" />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="recipientName">Recipient name</Label>
        <Input id="recipientName" name="recipientName" required />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="line1">Address line 1</Label>
        <Input id="line1" name="line1" required />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="line2">Address line 2 (optional)</Label>
        <Input id="line2" name="line2" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="city">City</Label>
        <Input id="city" name="city" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="region">Region (optional)</Label>
        <Input id="region" name="region" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="postalCode">Postal code</Label>
        <Input id="postalCode" name="postalCode" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="country">Country</Label>
        <Input id="country" name="country" required />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" name="phone" />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isDefault" className="size-4" />
        Set as default address
      </label>
      {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit sm:col-span-2">
        {isPending ? "Saving…" : "Add address"}
      </Button>
    </form>
  );
}

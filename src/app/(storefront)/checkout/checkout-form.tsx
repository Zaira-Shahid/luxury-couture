"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { placeOrder } from "@/features/checkout/actions";
import type { Address, MeasurementProfile } from "@/types/database";

export function CheckoutForm({
  addresses,
  measurementProfiles,
  requiresMeasurements,
}: {
  addresses: Address[];
  measurementProfiles: MeasurementProfile[];
  requiresMeasurements: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await placeOrder(formData);
      // placeOrder redirects on success — reaching here means an error.
      if (result && "error" in result) setError(result.error);
    });
  }

  if (addresses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a shipping address to your account before checking out.
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">Shipping address</p>
        <div className="flex flex-col gap-2">
          {addresses.map((address) => (
            <label
              key={address.id}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary"
            >
              <input type="radio" name="addressId" value={address.id} defaultChecked={address.is_default} required />
              <span>
                {address.recipient_name} — {address.line1}, {address.city}, {address.postal_code}
              </span>
            </label>
          ))}
        </div>
      </div>

      {requiresMeasurements ? (
        <div>
          <p className="mb-2 text-sm font-medium">Measurement profile</p>
          {measurementProfiles.length === 0 ? (
            <p className="text-sm text-destructive">
              Add a measurement profile to your account before checking out with a custom design.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {measurementProfiles.map((profile) => (
                <label
                  key={profile.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary"
                >
                  <input type="radio" name="measurementProfileId" value={profile.id} required />
                  <span>{profile.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium">Notes (optional)</p>
        <Textarea name="notes" rows={3} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Placing order…" : "Place Order"}
      </Button>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { acceptQuotation, rejectQuotation } from "@/features/quotations/actions";
import type { Address, MeasurementProfile } from "@/types/database";

export function QuotationActions({
  quotationId,
  addresses,
  measurementProfiles,
  requiresMeasurements,
}: {
  quotationId: string;
  addresses: Address[];
  measurementProfiles: MeasurementProfile[];
  requiresMeasurements: boolean;
}) {
  const [showAccept, setShowAccept] = useState(false);
  const [isAccepting, startAccepting] = useTransition();
  const [isRejecting, startRejecting] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept(formData: FormData) {
    setError(null);
    startAccepting(async () => {
      const result = await acceptQuotation(quotationId, formData);
      if (result && "error" in result) setError(result.error);
    });
  }

  function handleReject() {
    startRejecting(async () => {
      const result = await rejectQuotation(quotationId);
      if ("error" in result) toast.error(result.error);
      else toast.success("Quotation declined.");
    });
  }

  if (showAccept) {
    if (addresses.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          Add a shipping address to your account before accepting.
        </p>
      );
    }

    return (
      <form action={handleAccept} className="flex flex-col gap-4">
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
                Add a measurement profile before accepting this custom quotation.
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
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={isAccepting} className="w-fit">
          {isAccepting ? "Confirming…" : "Confirm & Place Order"}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex gap-2">
      <Button type="button" onClick={() => setShowAccept(true)}>
        Accept Quotation
      </Button>
      <Button type="button" variant="outline" disabled={isRejecting} onClick={handleReject}>
        Decline
      </Button>
    </div>
  );
}

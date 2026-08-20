"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimConfiguration, requestQuotation } from "@/features/builder/actions";
import { addBuilderConfigurationToCart } from "@/features/cart/actions";

export function ReviewStep({
  configId,
  token,
  isSignedIn,
  isClaimed,
}: {
  configId: string | null;
  token: string | null;
  isSignedIn: boolean;
  isClaimed: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [claiming, startClaimTransition] = useTransition();
  const [addingToCart, startAddToCart] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleClaim() {
    if (!configId || !token) return;
    startClaimTransition(async () => {
      const result = await claimConfiguration(configId, token);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Saved to your account.");
        router.refresh();
      }
    });
  }

  function handleAddToCart() {
    if (!configId) return;
    startAddToCart(async () => {
      // Cart items referencing a custom design require it to be claimed
      // first — a guest cart has no token-based way to prove ownership of
      // a design the way the builder's own share links do.
      if (!isClaimed) {
        if (!token) return;
        const claimResult = await claimConfiguration(configId, token);
        if ("error" in claimResult) {
          toast.error(claimResult.error);
          return;
        }
      }
      const result = await addBuilderConfigurationToCart(configId);
      if ("error" in result) toast.error(result.error);
      else {
        toast.success("Added to cart.");
        router.refresh();
      }
    });
  }

  function handleSubmit(formData: FormData) {
    if (!configId || !token) {
      setError("Please select at least one option before requesting a quotation.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await requestQuotation(configId, token, formData);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSubmitted(true);
      }
    });
  }

  if (submitted) {
    return (
      <div>
        <h2 className="font-heading text-2xl">Request Sent</h2>
        <p className="mt-2 text-muted-foreground">
          Thank you — our design team will review your custom piece and follow up with a formal
          quotation shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-heading text-2xl">Review &amp; Request Quotation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your design is saved automatically as you go — this link will always bring you back to
          it. When you&apos;re ready, request a formal quotation below.
        </p>
      </div>

      {isSignedIn && !isClaimed && configId ? (
        <div className="rounded-lg bg-secondary/50 p-4 text-sm">
          <p>Save this design to your account so you can find it later.</p>
          <Button type="button" size="sm" className="mt-2" disabled={claiming} onClick={handleClaim}>
            {claiming ? "Saving…" : "Save to My Account"}
          </Button>
        </div>
      ) : null}

      {configId ? (
        isSignedIn ? (
          <Button type="button" variant="outline" disabled={addingToCart} onClick={handleAddToCart} className="w-fit">
            {addingToCart ? "Adding…" : "Add to Cart"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>{" "}
            to add this design to your cart, or request a quotation below.
          </p>
        )
      ) : null}

      <form action={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactName">Name</Label>
            <Input id="contactName" name="contactName" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactEmail">Email</Label>
            <Input id="contactEmail" name="contactEmail" type="email" required />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contactPhone">Phone (optional)</Label>
          <Input id="contactPhone" name="contactPhone" />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={isPending} className="w-fit">
          {isPending ? "Sending…" : "Request Quotation"}
        </Button>
      </form>
    </div>
  );
}

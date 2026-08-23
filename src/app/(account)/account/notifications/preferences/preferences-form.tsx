"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  updateMarketingOptOut,
  updateNotificationPreferences,
} from "@/features/notifications/actions";

type CategoryOption = {
  value: string;
  label: string;
  description: string;
  enabled: boolean;
};

/**
 * Standard admin/account form shape for this project: a client wrapper
 * calling a server action inside useTransition, since React 18 has no
 * useActionState (see docs/ARCHITECTURE.md).
 *
 * The marketing toggle is a SEPARATE control on purpose. It writes
 * `profiles.marketing_opt_out`, the same column the one-click unsubscribe
 * link in every marketing email writes, rather than a second row in
 * notification_preferences that would drift from it.
 */
export function PreferencesForm({
  categories,
  marketingOptOut,
}: {
  categories: CategoryOption[];
  marketingOptOut: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [optOut, setOptOut] = useState(marketingOptOut);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateNotificationPreferences(formData);
      if ("error" in result) toast.error(result.error);
      else toast.success("Preferences saved.");
    });
  }

  function handleMarketingChange(next: boolean) {
    setOptOut(next);
    startTransition(async () => {
      const result = await updateMarketingOptOut(next);
      if ("error" in result) {
        toast.error(result.error);
        setOptOut(!next); // Put the switch back if the write did not land.
      } else {
        toast.success("Preference saved.");
      }
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {categories.map((category) => (
            <label
              key={category.value}
              className="flex items-start gap-3 rounded-lg border border-border p-4 text-sm"
            >
              <input
                type="checkbox"
                name="email"
                value={category.value}
                defaultChecked={category.enabled}
                className="mt-0.5 size-4"
              />
              <span>
                <span className="font-medium">{category.label}</span>
                <span className="mt-0.5 block text-muted-foreground">{category.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div>
          <Button type="submit" disabled={isPending}>
            Save preferences
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-sm font-medium">Marketing</h2>
        <label className="flex items-start gap-3 rounded-lg border border-border p-4 text-sm">
          <input
            type="checkbox"
            checked={!optOut}
            disabled={isPending}
            onChange={(event) => handleMarketingChange(!event.target.checked)}
            className="mt-0.5 size-4"
          />
          <span>
            <span className="font-medium">New collections and offers</span>
            <span className="mt-0.5 block text-muted-foreground">
              Occasional emails about new pieces and promotions. Unsubscribing here is the same as
              using the link at the bottom of those emails.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

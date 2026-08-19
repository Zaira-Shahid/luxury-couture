"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { saveProfile } from "@/features/measurements/actions";

export function NewProfileButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const formData = new FormData();
    formData.set("label", "My measurements");
    formData.set("unit", "cm");
    startTransition(async () => {
      const result = await saveProfile(null, formData);
      // saveProfile redirects to the new profile's edit page on success —
      // reaching this line at all means it didn't (an error, most likely).
      if (result && "error" in result) toast.error(result.error);
    });
  }

  return (
    <Button disabled={isPending} onClick={handleClick}>
      {isPending ? "Creating…" : "New Profile"}
    </Button>
  );
}

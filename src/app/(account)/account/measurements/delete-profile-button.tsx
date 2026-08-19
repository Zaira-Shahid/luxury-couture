"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteProfile } from "@/features/measurements/actions";

export function DeleteProfileButton({ profileId }: { profileId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await deleteProfile(profileId);
      if ("error" in result) toast.error(result.error);
      else toast.success("Profile deleted.");
    });
  }

  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={handleClick}>
      {isPending ? "Removing…" : "Delete"}
    </Button>
  );
}

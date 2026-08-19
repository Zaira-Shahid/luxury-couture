"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { approveProfile, requestCorrection } from "@/features/admin-measurements/actions";

export function AdminActions({ profileId }: { profileId: string }) {
  const [isApproving, startApproving] = useTransition();
  const [isRequesting, startRequesting] = useTransition();
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [notes, setNotes] = useState("");

  function handleApprove() {
    startApproving(async () => {
      const result = await approveProfile(profileId);
      if ("error" in result) toast.error(result.error);
      else toast.success("Approved.");
    });
  }

  function handleRequestCorrection() {
    const formData = new FormData();
    formData.set("adminNotes", notes);
    startRequesting(async () => {
      const result = await requestCorrection(profileId, formData);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Correction requested.");
        setShowCorrectionForm(false);
        setNotes("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button disabled={isApproving} onClick={handleApprove}>
          {isApproving ? "Approving…" : "Approve"}
        </Button>
        <Button variant="outline" onClick={() => setShowCorrectionForm((v) => !v)}>
          Request Correction
        </Button>
      </div>
      {showCorrectionForm ? (
        <div className="flex flex-col gap-2">
          <Textarea
            rows={3}
            placeholder="Explain what the customer needs to fix…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button
            size="sm"
            disabled={isRequesting || !notes.trim()}
            onClick={handleRequestCorrection}
            className="w-fit"
          >
            {isRequesting ? "Sending…" : "Send Correction Request"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

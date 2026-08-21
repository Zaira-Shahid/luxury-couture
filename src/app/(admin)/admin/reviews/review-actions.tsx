"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { respondToReview, setReviewFeatured, setReviewPublished } from "@/features/admin-reviews/actions";

export function ReviewActions({
  reviewId,
  isPublished,
  isFeatured,
  adminResponse,
}: {
  reviewId: string;
  isPublished: boolean;
  isFeatured: boolean;
  adminResponse: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [showResponseForm, setShowResponseForm] = useState(false);

  function handlePublishToggle() {
    startTransition(async () => {
      const result = await setReviewPublished(reviewId, !isPublished);
      if ("error" in result) toast.error(result.error);
    });
  }

  function handleFeatureToggle() {
    startTransition(async () => {
      const result = await setReviewFeatured(reviewId, !isFeatured);
      if ("error" in result) toast.error(result.error);
    });
  }

  function handleRespond(formData: FormData) {
    startTransition(async () => {
      const result = await respondToReview(reviewId, formData);
      if ("error" in result) toast.error(result.error);
      else setShowResponseForm(false);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={isPublished ? "outline" : "default"} disabled={isPending} onClick={handlePublishToggle}>
          {isPublished ? "Unpublish" : "Publish"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleFeatureToggle}>
          {isFeatured ? "Unfeature" : "Feature"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => setShowResponseForm((v) => !v)}>
          {adminResponse ? "Edit response" : "Respond"}
        </Button>
      </div>
      {showResponseForm ? (
        <form action={handleRespond} className="flex flex-col gap-2">
          <Textarea name="adminResponse" rows={2} defaultValue={adminResponse ?? ""} placeholder="Thank you for your feedback…" />
          <Button type="submit" size="sm" disabled={isPending} className="w-fit">
            Save Response
          </Button>
        </form>
      ) : adminResponse ? (
        <p className="text-xs text-muted-foreground">Response: {adminResponse}</p>
      ) : null}
    </div>
  );
}

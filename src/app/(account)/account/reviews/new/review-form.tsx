"use client";

import { Star } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addReviewVideoLink, submitReview, uploadReviewPhoto } from "@/features/reviews/actions";

type OrderProduct = { id: string; name: string };

export function ReviewForm({
  orderId,
  orderNumber,
  products,
  defaultReviewerName,
}: {
  orderId: string;
  orderNumber: string;
  products: OrderProduct[];
  defaultReviewerName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploadingPhoto, startUploadingPhoto] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("rating", String(rating));
    startTransition(async () => {
      const result = await submitReview(formData);
      if ("error" in result) {
        setError(result.error);
      } else {
        setReviewId(result.data.reviewId);
        toast.success("Review submitted — it'll appear once approved.");
      }
    });
  }

  function handlePhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file || !reviewId) return;
    startUploadingPhoto(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadReviewPhoto(reviewId, formData);
      if ("error" in result) toast.error(result.error);
      else setPhotos((prev) => [...prev, result.data.url]);
    });
  }

  function handleVideoLink(formData: FormData) {
    if (!reviewId) return;
    startTransition(async () => {
      const result = await addReviewVideoLink(reviewId, formData);
      if ("error" in result) toast.error(result.error);
      else toast.success("Video link added.");
    });
  }

  if (reviewId) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-primary">
          Thank you — your review for order {orderNumber} has been submitted and is awaiting approval.
        </p>

        <div>
          <Label className="mb-2">Add photos (optional)</Label>
          {photos.length > 0 ? (
            <div className="mb-2 grid grid-cols-4 gap-2">
              {photos.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="" className="aspect-square rounded-lg object-cover" />
              ))}
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploadingPhoto}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploadingPhoto ? "Uploading…" : "Add photo"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              handlePhoto(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <form action={handleVideoLink} className="flex flex-col gap-1.5">
          <Label htmlFor="videoUrl">Add a video testimonial link (optional)</Label>
          <div className="flex gap-2">
            <Input id="videoUrl" name="url" placeholder="https://…" className="flex-1" />
            <Button type="submit" variant="outline" size="sm" disabled={isPending}>
              Add
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="orderId" value={orderId} />

      <div className="flex flex-col gap-1.5">
        <Label>Rating</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              className="text-accent"
            >
              <Star className="size-6" fill={value <= rating ? "currentColor" : "none"} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </div>

      {products.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="productId">Which piece is this review for? (optional)</Label>
          <select
            id="productId"
            name="productId"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">This order in general</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title (optional)</Label>
        <Input id="title" name="title" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body">Your review (optional)</Label>
        <Textarea id="body" name="body" rows={4} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reviewerName">Display name (optional)</Label>
        <Input id="reviewerName" name="reviewerName" defaultValue={defaultReviewerName} placeholder="Verified Customer" />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Submitting…" : "Submit Review"}
      </Button>
    </form>
  );
}

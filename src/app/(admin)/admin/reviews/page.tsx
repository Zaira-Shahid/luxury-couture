import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAdminReviews } from "@/lib/admin/get-reviews";

import { ReviewActions } from "./review-actions";

export const metadata: Metadata = { title: "Reviews" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminReviewsPage() {
  const reviews = await getAdminReviews();

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl">Reviews</h1>
        <Button render={<Link href="/admin/reviews/gallery" />} variant="outline">
          Social Gallery
        </Button>
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <div key={review.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex gap-0.5 text-accent">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-4" fill={i < review.rating ? "currentColor" : "none"} strokeWidth={1.5} />
                    ))}
                  </div>
                  <p className="mt-1 text-sm font-medium">
                    {review.reviewer_name ?? "Verified Customer"}
                    {review.order_id ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        Verified purchase{review.orders ? ` · ${review.orders.order_number}` : ""}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{formatDate(review.created_at)}</p>
                  <p>{review.is_published ? "Published" : "Pending"}{review.is_featured ? " · Featured" : ""}</p>
                </div>
              </div>

              {review.title ? <p className="text-sm font-medium">{review.title}</p> : null}
              {review.body ? <p className="text-sm text-muted-foreground">{review.body}</p> : null}

              {review.review_media.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {review.review_media.map((media) =>
                    media.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={media.id} src={media.url} alt="" className="size-16 rounded-lg object-cover" />
                    ) : (
                      <a
                        key={media.id}
                        href={media.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex size-16 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground hover:underline"
                      >
                        Video
                      </a>
                    )
                  )}
                </div>
              ) : null}

              <ReviewActions
                reviewId={review.id}
                isPublished={review.is_published}
                isFeatured={review.is_featured}
                adminResponse={review.admin_response}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

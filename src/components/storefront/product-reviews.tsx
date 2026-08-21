import { Star } from "lucide-react";

import { getProductRatingSummary, getProductReviews } from "@/lib/reviews/get-reviews";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export async function RatingSummary({ productId }: { productId: string }) {
  const { average, count } = await getProductRatingSummary(productId);
  if (count === 0) return null;

  return (
    <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
      <div className="flex gap-0.5 text-accent">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="size-4" fill={i < Math.round(average) ? "currentColor" : "none"} strokeWidth={1.5} />
        ))}
      </div>
      <span>
        {average.toFixed(1)} ({count} review{count === 1 ? "" : "s"})
      </span>
    </div>
  );
}

export async function ProductReviews({ productId }: { productId: string }) {
  const reviews = await getProductReviews(productId);
  if (reviews.length === 0) return null;

  return (
    <section className="mt-20">
      <h2 className="mb-8 font-heading text-3xl">Reviews</h2>
      <div className="flex flex-col gap-6">
        {reviews.map((review) => (
          <div key={review.id} className="border-b border-border pb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-0.5 text-accent">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4" fill={i < review.rating ? "currentColor" : "none"} strokeWidth={1.5} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(review.created_at)}</span>
            </div>
            <p className="mt-2 text-sm font-medium">
              {review.reviewer_name || "Verified Customer"}
              {review.order_id ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">Verified purchase</span>
              ) : null}
            </p>
            {review.title ? <p className="mt-1 text-sm font-medium">{review.title}</p> : null}
            {review.body ? <p className="mt-1 text-sm text-muted-foreground">{review.body}</p> : null}
            {review.review_media.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {review.review_media.map((media) =>
                  media.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={media.id} src={media.url} alt="" className="size-20 rounded-lg object-cover" />
                  ) : (
                    <a
                      key={media.id}
                      href={media.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex size-20 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground hover:underline"
                    >
                      Watch video
                    </a>
                  )
                )}
              </div>
            ) : null}
            {review.admin_response ? (
              <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <span className="font-medium">Response from Luxury Lehenga Couture: </span>
                {review.admin_response}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

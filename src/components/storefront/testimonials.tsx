import { Star } from "lucide-react";

import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { getFeaturedTestimonials } from "@/lib/catalog/get-featured";

export async function Testimonials() {
  const reviews = await getFeaturedTestimonials();
  if (reviews.length === 0) return null;

  return (
    <section className="container py-20">
      <ScrollReveal>
        <h2 className="mb-10 text-center font-heading text-3xl sm:text-4xl">
          What Our Clients Say
        </h2>
      </ScrollReveal>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review, i) => (
          <ScrollReveal key={review.id} delay={i * 0.05}>
            <div className="flex h-full flex-col gap-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
              <div className="flex gap-0.5 text-accent">
                {Array.from({ length: 5 }).map((_, star) => (
                  <Star
                    key={star}
                    className="size-4"
                    fill={star < review.rating ? "currentColor" : "none"}
                    strokeWidth={1.5}
                  />
                ))}
              </div>
              {review.title ? <p className="font-medium">{review.title}</p> : null}
              {review.body ? (
                <p className="flex-1 text-sm text-muted-foreground">{review.body}</p>
              ) : null}
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                {review.reviewer_name || "Verified Customer"}
              </p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}

import { ImageIcon } from "lucide-react";

import { ScrollReveal } from "@/components/motion/scroll-reveal";

/** Genuine placeholder per the plan's own wording — no real gallery/Instagram feed yet. */
export function SocialGallery() {
  return (
    <section className="container py-20">
      <ScrollReveal>
        <h2 className="mb-2 text-center font-heading text-3xl sm:text-4xl">Follow Along</h2>
        <p className="mb-10 text-center text-sm text-muted-foreground">@luxurylehengacouture</p>
      </ScrollReveal>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <ScrollReveal key={i} delay={i * 0.04}>
            <div className="flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br from-secondary to-muted">
              <ImageIcon className="size-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}

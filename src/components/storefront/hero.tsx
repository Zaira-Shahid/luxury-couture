"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

/**
 * MODULE 28: was framer-motion (`motion`, `useScroll`, `useTransform`).
 * Now CSS keyframes plus a small passive scroll listener, which removed
 * the last import of a 5.4 MB dependency from the storefront.
 *
 * Two decisions worth keeping:
 *
 * 1. The <h1> animates TRANSFORM ONLY, no opacity fade. It is this
 *    page's LCP element, and an element at opacity 0 has not painted —
 *    so the previous `initial={{ opacity: 0 }}` was pushing Largest
 *    Contentful Paint out by the full length of the animation on the
 *    site's most important route. Moving an opaque element costs nothing
 *    by that measure. The smaller supporting lines are not LCP
 *    candidates and keep their fade.
 *
 * 2. The parallax is driven by a rAF-throttled passive scroll listener.
 *    Passive so it never blocks scrolling, rAF-throttled so it writes at
 *    most once per frame, and skipped entirely under
 *    prefers-reduced-motion — parallax is exactly the kind of motion
 *    that causes vestibular discomfort.
 */
export function Hero({
  heading,
  subheading,
  imageUrl,
}: {
  heading: string;
  subheading: string;
  imageUrl: string | null;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const layer = parallaxRef.current;
    if (!section || !layer) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    function update() {
      frame = 0;
      const rect = section!.getBoundingClientRect();
      // Matches the previous offset: 0 while the top is at the top of the
      // viewport, 1 by the time the section has scrolled fully past it.
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
      layer!.style.transform = `translateY(${progress * 20}%)`;
    }

    function onScroll() {
      // Coalesce to one write per frame; a raw scroll handler can fire
      // far more often than the compositor can use.
      if (!frame) frame = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative flex min-h-[85vh] items-center overflow-hidden">
      {imageUrl ? (
        // aria-hidden, not role="img" with an empty label: this is a
        // decorative backdrop behind the heading, and announcing an
        // unlabelled image adds noise without adding meaning.
        <div ref={parallaxRef} aria-hidden="true" className="absolute inset-0 -z-10 will-change-transform">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
          <div className="absolute inset-0 bg-background/60" />
        </div>
      ) : (
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-secondary to-background" />
      )}

      <div className="container flex flex-col items-center gap-6 text-center">
        <p className="animate-rise-in text-xs tracking-[0.3em] text-muted-foreground uppercase">
          Bespoke Bridal &amp; Occasion Wear
        </p>
        <h1
          className="animate-settle-in max-w-3xl font-heading text-5xl sm:text-7xl"
          style={{ "--stagger": "100ms" } as React.CSSProperties}
        >
          {heading}
        </h1>
        <p
          className="animate-rise-in max-w-xl text-muted-foreground"
          style={{ "--stagger": "200ms" } as React.CSSProperties}
        >
          {subheading}
        </p>
        <div
          className="animate-rise-in flex flex-wrap items-center justify-center gap-3"
          style={{ "--stagger": "300ms" } as React.CSSProperties}
        >
          <Button render={<Link href="/collections" />} size="lg">
            Shop Collections
          </Button>
          <Button render={<Link href="/builder" />} size="lg" variant="outline">
            Design Your Own
          </Button>
        </div>
      </div>
    </section>
  );
}

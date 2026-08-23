"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Replaces framer-motion's `whileInView` with an IntersectionObserver.
 *
 * FAILS VISIBLE, which is the whole design of it. The element only
 * becomes hidden once this hook has mounted and confirmed an observer
 * exists; the server-rendered markup starts at `data-revealed="true"`.
 * So if JavaScript never runs — disabled, still loading, a crawler, an
 * error in an unrelated bundle — the content is simply *there* rather
 * than permanently invisible.
 *
 * That is the failure mode scroll-reveal libraries get wrong most often,
 * and it turns a decorative animation into a blank page.
 *
 * `once: true` matches the previous framer-motion behaviour — content
 * reveals on first sight and stays revealed. Re-hiding something the
 * reader has already seen is a distraction, not an effect.
 */
export function useRevealOnScroll<T extends HTMLElement>({
  rootMargin = "-80px",
}: { rootMargin?: string } = {}) {
  const ref = useRef<T | null>(null);
  // Starts true so the pre-hydration markup is visible; see above.
  const [revealed, setRevealed] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // No observer support (or a very old browser): leave it visible.
    if (typeof IntersectionObserver === "undefined") return;

    // Respect the user's motion preference rather than animating and
    // relying on the CSS override to flatten it — skipping the hidden
    // state entirely means no flash of missing content either.
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    // Already on screen at mount (above the fold): don't hide it just to
    // animate it back in, which would read as a flicker.
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return;

    setRevealed(false);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, revealed };
}

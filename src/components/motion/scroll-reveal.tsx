"use client";

import type { ReactNode } from "react";

import { useRevealOnScroll } from "./use-reveal-on-scroll";

/**
 * MODULE 28: was framer-motion's `whileInView`. Now an
 * IntersectionObserver plus a CSS keyframe — see use-reveal-on-scroll.ts
 * for why it fails VISIBLE rather than hidden.
 *
 * The delay is passed as a custom property rather than a class so that
 * arbitrary stagger values work without generating a Tailwind class per
 * value.
 */
export function ScrollReveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, revealed } = useRevealOnScroll<HTMLDivElement>();

  return (
    <div
      ref={ref}
      data-revealed={revealed}
      className={className ? `reveal ${className}` : "reveal"}
      style={delay ? ({ "--reveal-delay": `${delay * 1000}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A light fade-in on route change.
 *
 * MODULE 28: was framer-motion. This component sits in the storefront
 * LAYOUT, so it put a 5.4 MB dependency into every customer-facing
 * route's bundle in order to animate opacity from 0 to 1 over 300ms —
 * which is one CSS keyframe.
 *
 * `key={pathname}` is what makes it work: React unmounts and remounts the
 * subtree on navigation, so the CSS animation restarts. Same mechanism
 * framer-motion was using, without the library.
 *
 * It now also honours prefers-reduced-motion for free, because the global
 * override in globals.css applies to CSS animations. framer-motion's
 * JS-driven transforms did not.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}

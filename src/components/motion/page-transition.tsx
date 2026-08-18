"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A light fade-in on route change, not a full AnimatePresence exit/enter
 * system — this module's own requirement is to "remain performant," and a
 * heavier transition system would fight Next's streaming/prefetch model
 * more than it's worth for this brand.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

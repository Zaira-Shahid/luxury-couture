"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

import { Button } from "@/components/ui/button";

export function Hero({
  heading,
  subheading,
  imageUrl,
}: {
  heading: string;
  subheading: string;
  imageUrl: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const parallaxY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  return (
    <section ref={ref} className="relative flex min-h-[85vh] items-center overflow-hidden">
      {imageUrl ? (
        <motion.div
          style={{ y: parallaxY }}
          className="absolute inset-0 -z-10 bg-cover bg-center"
          role="img"
          aria-label=""
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
          <div className="absolute inset-0 bg-background/60" />
        </motion.div>
      ) : (
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-secondary to-background" />
      )}

      <div className="container flex flex-col items-center gap-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-xs tracking-[0.3em] text-muted-foreground uppercase"
        >
          Bespoke Bridal &amp; Occasion Wear
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="max-w-3xl font-heading text-5xl sm:text-7xl"
        >
          {heading}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="max-w-xl text-muted-foreground"
        >
          {subheading}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Button render={<Link href="/collections" />} size="lg">
            Shop Collections
          </Button>
          <Button render={<Link href="/builder" />} size="lg" variant="outline">
            Design Your Own
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import { useEffect } from "react";

import { logger } from "@/lib/logger";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Unhandled root error", error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center text-foreground">
          <p className="text-sm tracking-[0.3em] text-muted-foreground uppercase">Error</p>
          <h1 className="font-heading text-4xl">Something went wrong</h1>
          <p className="max-w-md text-muted-foreground">
            Please try again. If the problem persists, contact us.
          </p>
          <button
            onClick={reset}
            className="rounded-lg border border-border bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

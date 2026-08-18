"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Unhandled route error", error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm tracking-[0.3em] text-muted-foreground uppercase">Error</p>
      <h1 className="font-heading text-4xl">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        Please try again. If the problem persists, contact us.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}

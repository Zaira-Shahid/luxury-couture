"use client";

import { X } from "lucide-react";
import { useState } from "react";

export function AnnouncementBar({ text }: { text: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="relative flex items-center justify-center bg-primary px-8 py-2 text-center text-xs font-medium text-primary-foreground">
      <p>{text}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        className="absolute right-2 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

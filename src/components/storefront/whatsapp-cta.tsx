import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Reuses store.socialLinks.whatsapp (Module 3) — a plain wa.me-style link the admin pastes in. */
export function WhatsAppCta({ url }: { url: string | undefined }) {
  if (!url) return null;

  return (
    <Button render={<Link href={url} target="_blank" rel="noreferrer noopener" />} variant="outline">
      Chat on WhatsApp
    </Button>
  );
}

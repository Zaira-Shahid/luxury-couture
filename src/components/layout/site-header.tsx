import Link from "next/link";

import { siteConfig } from "@/lib/config/site";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="font-heading text-xl tracking-wide">
          {siteConfig.name}
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          <Link href="/" className="transition-colors hover:text-foreground">
            Home
          </Link>
        </nav>
      </div>
    </header>
  );
}

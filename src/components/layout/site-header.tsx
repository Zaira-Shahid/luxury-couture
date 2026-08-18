import Link from "next/link";

import { siteConfig } from "@/lib/config/site";
import { getAuthUser } from "@/lib/auth/session";

export async function SiteHeader() {
  const user = await getAuthUser();

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
          {user ? (
            <Link href="/account" className="transition-colors hover:text-foreground">
              My account
            </Link>
          ) : (
            <>
              <Link href="/login" className="transition-colors hover:text-foreground">
                Sign in
              </Link>
              <Link href="/register" className="transition-colors hover:text-foreground">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

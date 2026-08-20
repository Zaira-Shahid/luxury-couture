import Link from "next/link";

import { siteConfig } from "@/lib/config/site";
import { getAuthUser } from "@/lib/auth/session";
import { getCartItemCount } from "@/lib/cart/get-cart";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

import { AnnouncementBar } from "./announcement-bar";

export async function SiteHeader() {
  const [user, settings, cartCount] = await Promise.all([
    getAuthUser(),
    getSiteSettings(),
    getCartItemCount(),
  ]);

  return (
    <>
      {settings.store.announcementEnabled && settings.store.announcementText ? (
        <AnnouncementBar text={settings.store.announcementText} />
      ) : null}
      <header className="border-b border-border bg-background">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center font-heading text-xl tracking-wide">
            {settings.branding.logoUrl ? (
              // Admin-supplied external URL (no Storage bucket / host
              // allowlist yet) — next/image would throw on an unconfigured
              // remote host, so a plain <img> is the correct choice here.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.branding.logoUrl} alt={siteConfig.name} className="h-8 w-auto" />
            ) : (
              siteConfig.name
            )}
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <Link href="/collections" className="transition-colors hover:text-foreground">
              Collections
            </Link>
            <Link href="/builder" className="transition-colors hover:text-foreground">
              Design Your Own
            </Link>
            <Link href="/consultations" className="transition-colors hover:text-foreground">
              Book a Consultation
            </Link>
            <Link href="/contact" className="transition-colors hover:text-foreground">
              Contact
            </Link>
            <Link href="/cart" className="transition-colors hover:text-foreground">
              Cart{cartCount > 0 ? ` (${cartCount})` : ""}
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
    </>
  );
}

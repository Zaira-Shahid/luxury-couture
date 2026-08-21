import Link from "next/link";

import { ConsentPreferencesLink } from "@/components/analytics/consent-preferences-link";
import { siteConfig } from "@/lib/config/site";
import { getPublishedPages } from "@/lib/content/get-content";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

const SOCIAL_LABELS = {
  instagram: "Instagram",
  facebook: "Facebook",
  pinterest: "Pinterest",
  whatsapp: "WhatsApp",
} as const;

/**
 * Static footer destinations. CMS pages are appended to these at render
 * time, which is the internal-linking half of Module 20 — every published
 * page gets a crawlable link from every page of the site.
 */
const SHOP_LINKS = [
  { href: "/products", label: "Shop All" },
  { href: "/collections", label: "Collections" },
  { href: "/builder", label: "Custom Builder" },
];

const HELP_LINKS = [
  { href: "/consultations", label: "Book a Consultation" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "Journal" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
];

export async function SiteFooter() {
  const [settings, pages] = await Promise.all([getSiteSettings(), getPublishedPages()]);
  const socialEntries = Object.entries(settings.store.socialLinks).filter(([, url]) => url);
  const hasContact =
    settings.store.contactEmail || settings.store.contactPhone || settings.store.contactAddress;

  return (
    <footer className="border-t border-border bg-background">
      <div className="container flex flex-col gap-6 py-10 text-sm text-muted-foreground">
        <nav aria-label="Footer" className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <p className="font-medium text-foreground">Shop</p>
            {SHOP_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-medium text-foreground">Help</p>
            {HELP_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
                {link.label}
              </Link>
            ))}
            <ConsentPreferencesLink />
          </div>
          {pages.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="font-medium text-foreground">About</p>
              {pages.map((page) => (
                <Link
                  key={page.id}
                  href={`/${page.slug}`}
                  className="transition-colors hover:text-foreground"
                >
                  {page.title}
                </Link>
              ))}
            </div>
          ) : null}
        </nav>

        <div className="flex flex-col gap-6 border-t border-border pt-6 sm:flex-row sm:justify-between">
          {hasContact ? (
            <div className="flex flex-col gap-1">
              {settings.store.contactEmail ? <p>{settings.store.contactEmail}</p> : null}
              {settings.store.contactPhone ? <p>{settings.store.contactPhone}</p> : null}
              {settings.store.contactAddress ? <p>{settings.store.contactAddress}</p> : null}
            </div>
          ) : null}
          {socialEntries.length ? (
            <div className="flex gap-4">
              {socialEntries.map(([key, url]) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="transition-colors hover:text-foreground"
                >
                  {SOCIAL_LABELS[key as keyof typeof SOCIAL_LABELS] ?? key}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <p className="text-center">
          {settings.store.footerText ?? (
            <>
              &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
            </>
          )}
        </p>
      </div>
    </footer>
  );
}

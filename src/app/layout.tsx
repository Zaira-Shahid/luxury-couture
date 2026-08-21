import type { Metadata } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import { Toaster } from "sonner";

import { siteConfig } from "@/lib/config/site";
import { absoluteUrl } from "@/lib/seo/urls";
import { getSiteSettings } from "@/lib/settings/get-site-settings";
import { cn } from "@/lib/utils";

import "./globals.css";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontHeading = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const title = settings.seo.defaultTitle ?? siteConfig.name;
  const description = settings.seo.defaultDescription ?? siteConfig.description;
  const ogImage = settings.seo.defaultOgImageUrl;

  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: title, template: `%s | ${title}` },
    description,
    // Site-wide fallbacks. Public pages replace these wholesale via
    // `buildMetadata` (@/lib/seo/build-metadata), which also sets the
    // canonical URL — deliberately not set here, since a root-level
    // canonical would wrongly point every uncustomised route at "/".
    robots: settings.seo.indexingEnabled
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      type: "website",
      siteName: title,
      locale: "en_GB",
      title,
      description,
      url: absoluteUrl("/"),
      images: ogImage ? [{ url: ogImage, alt: title }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
      site: settings.seo.twitterHandle ?? undefined,
    },
    // Google Search Console HTML-tag verification (see docs/SEO.md).
    verification: settings.seo.googleSiteVerification
      ? { google: settings.seo.googleSiteVerification }
      : undefined,
    icons: settings.branding.faviconUrl ? { icon: settings.branding.faviconUrl } : undefined,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  // Runtime brand-color overrides (Module 3/25 admin-configurable) on top
  // of globals.css's developer defaults — only set the CSS vars that have
  // an actual admin value, so unset ones keep falling through to :root.
  const themeStyle: Record<string, string> = {};
  if (settings.theme.primary) themeStyle["--primary"] = settings.theme.primary;
  if (settings.theme.accent) themeStyle["--accent"] = settings.theme.accent;

  return (
    <html
      lang="en"
      className={cn(fontSans.variable, fontHeading.variable)}
      style={themeStyle as React.CSSProperties}
    >
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}

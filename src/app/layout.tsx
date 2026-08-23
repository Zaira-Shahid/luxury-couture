import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import { siteConfig } from "@/lib/config/site";
import { absoluteUrl } from "@/lib/seo/urls";
import { fontClassesFor } from "@/lib/settings/fonts";
import { getSiteSettings } from "@/lib/settings/get-site-settings";
import { cn } from "@/lib/utils";

import "./globals.css";

/**
 * MODULE 28. Split from generateMetadata because Next 15 requires
 * viewport as its own export.
 *
 * `maximumScale` and `userScalable` are deliberately NOT set: capping
 * zoom is a common "polish" tweak that breaks WCAG 1.4.4 outright for
 * anyone who needs to magnify text. The default (unrestricted zoom) is
 * the accessible one.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

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

  // Runtime theme overrides (Module 3, extended in Module 25) layered on
  // top of globals.css's developer defaults. Only variables with an
  // actual admin value are emitted, so an unset one keeps falling through
  // to :root rather than being defined as an empty string — which would
  // override the default with nothing and render an invisible element.
  const themeStyle: Record<string, string> = {};
  const themeVars: [string, string | null][] = [
    ["--primary", settings.theme.primary],
    ["--accent", settings.theme.accent],
    ["--background", settings.theme.background],
    ["--foreground", settings.theme.foreground],
    ["--radius", settings.theme.radius],
  ];
  for (const [name, value] of themeVars) {
    if (value) themeStyle[name] = value;
  }

  return (
    <html
      lang="en"
      className={cn(fontClassesFor(settings.theme.fontPreset))}
      style={themeStyle as React.CSSProperties}
    >
      <body className="antialiased">
        {/*
          Skip link. First focusable element on every page, so a keyboard
          or screen-reader user can jump past the header nav instead of
          tabbing through it on each navigation. Targets #main-content,
          which each layout's <main> carries.
        */}
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}

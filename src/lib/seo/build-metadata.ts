import type { Metadata } from "next";

import { siteConfig } from "@/lib/config/site";
import { getSiteSettings } from "@/lib/settings/get-site-settings";
import type { SeoMetadata } from "@/types/database";

import { absoluteAssetUrl, absoluteUrl } from "./urls";

export type BuildMetadataInput = {
  /** The entity's own title (product name, page title). */
  title?: string | null;
  /** The entity's own description. */
  description?: string | null;
  /** App path for the canonical URL, e.g. "/products/red-lehenga". */
  path: string;
  /** The entity's own share image (product photo, cover image). */
  image?: string | null;
  /** "article" for blog posts, "website" for everything else. */
  type?: "website" | "article";
  /** Admin-authored overrides from `seo_metadata`, when the page has any. */
  overrides?: SeoMetadata | null;
  /**
   * Skip the root layout's "%s | Brand" template — for the home page,
   * where the brand name is already the whole title.
   */
  absoluteTitle?: boolean;
  publishedTime?: string | null;
  modifiedTime?: string | null;
};

/**
 * The single place page metadata is assembled, so canonical/OG/Twitter
 * rules stay consistent across every route.
 *
 * Precedence, highest first:
 *   1. admin `seo_metadata` override for this exact entity
 *   2. the entity's own field (product name, page title, ...)
 *   3. site-wide defaults from `site_settings` (admin-managed)
 *   4. hardcoded `siteConfig` fallbacks
 *
 * `robots` is driven by the `seo.indexingEnabled` setting so the owner can
 * keep the whole site out of the index until launch.
 */
export async function buildMetadata(input: BuildMetadataInput): Promise<Metadata> {
  const settings = await getSiteSettings();
  const { overrides } = input;

  const title = overrides?.meta_title || input.title || settings.seo.defaultTitle || siteConfig.name;
  const description =
    overrides?.meta_description ||
    input.description ||
    settings.seo.defaultDescription ||
    siteConfig.description;

  // An admin-set canonical wins outright — that's the whole point of the
  // field (pointing duplicate/campaign URLs at the real one).
  const canonical = overrides?.canonical_url || absoluteUrl(input.path);

  const image =
    absoluteAssetUrl(overrides?.og_image_url) ??
    absoluteAssetUrl(input.image) ??
    absoluteAssetUrl(settings.seo.defaultOgImageUrl);

  const siteName = settings.seo.defaultTitle || siteConfig.name;
  const indexable = settings.seo.indexingEnabled;

  return {
    title: input.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      type: input.type ?? "website",
      url: canonical,
      title,
      description,
      siteName,
      locale: "en_GB",
      images: image ? [{ url: image, alt: title }] : undefined,
      ...(input.type === "article"
        ? {
            publishedTime: input.publishedTime ?? undefined,
            modifiedTime: input.modifiedTime ?? undefined,
          }
        : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
      site: settings.seo.twitterHandle ?? undefined,
      creator: settings.seo.twitterHandle ?? undefined,
    },
  };
}

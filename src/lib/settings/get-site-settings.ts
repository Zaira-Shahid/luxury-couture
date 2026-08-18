import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

import { DEFAULT_SITE_SETTINGS, type SiteSettings, type SocialLinks } from "./types";

type Row = { key: string; value: unknown };

function applyRow(settings: SiteSettings, row: Row) {
  switch (row.key) {
    case "theme.primary":
      settings.theme.primary = typeof row.value === "string" ? row.value : null;
      break;
    case "theme.accent":
      settings.theme.accent = typeof row.value === "string" ? row.value : null;
      break;
    case "branding.logo_url":
      settings.branding.logoUrl = typeof row.value === "string" ? row.value : null;
      break;
    case "branding.favicon_url":
      settings.branding.faviconUrl = typeof row.value === "string" ? row.value : null;
      break;
    case "store.announcement_enabled":
      settings.store.announcementEnabled = row.value === true;
      break;
    case "store.announcement_text":
      settings.store.announcementText = typeof row.value === "string" ? row.value : null;
      break;
    case "store.social_links":
      settings.store.socialLinks =
        row.value && typeof row.value === "object" ? (row.value as SocialLinks) : {};
      break;
    case "store.contact_email":
      settings.store.contactEmail = typeof row.value === "string" ? row.value : null;
      break;
    case "store.contact_phone":
      settings.store.contactPhone = typeof row.value === "string" ? row.value : null;
      break;
    case "store.contact_address":
      settings.store.contactAddress = typeof row.value === "string" ? row.value : null;
      break;
    case "store.footer_text":
      settings.store.footerText = typeof row.value === "string" ? row.value : null;
      break;
    case "seo.default_title":
      settings.seo.defaultTitle = typeof row.value === "string" ? row.value : null;
      break;
    case "seo.default_description":
      settings.seo.defaultDescription = typeof row.value === "string" ? row.value : null;
      break;
    case "seo.default_og_image_url":
      settings.seo.defaultOgImageUrl = typeof row.value === "string" ? row.value : null;
      break;
    case "homepage.seo_title":
      settings.homepage.seoTitle = typeof row.value === "string" ? row.value : null;
      break;
    case "homepage.seo_description":
      settings.homepage.seoDescription = typeof row.value === "string" ? row.value : null;
      break;
    case "homepage.hero_heading":
      settings.homepage.heroHeading = typeof row.value === "string" ? row.value : null;
      break;
    case "homepage.hero_subheading":
      settings.homepage.heroSubheading = typeof row.value === "string" ? row.value : null;
      break;
    case "homepage.hero_image_url":
      settings.homepage.heroImageUrl = typeof row.value === "string" ? row.value : null;
      break;
    default:
      // Unrecognized keys (future modules, typos) are ignored rather than
      // breaking the whole settings fetch.
      break;
  }
}

/**
 * Fetches every site_settings row and merges it over the hardcoded
 * defaults into one typed object. Memoized per request (React cache) since
 * layout, header, and footer all read this independently.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const settings: SiteSettings = structuredClone(DEFAULT_SITE_SETTINGS);

  const supabase = await createClient();
  const { data, error } = await supabase.from("site_settings").select("key, value");

  if (error) {
    logger.warn("failed to load site_settings, using defaults", { message: error.message });
    return settings;
  }

  for (const row of (data ?? []) as Row[]) applyRow(settings, row);
  return settings;
});

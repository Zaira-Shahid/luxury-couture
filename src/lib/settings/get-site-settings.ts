import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

import { SETTINGS_REGISTRY, findEntry } from "./registry";
import { DEFAULT_SITE_SETTINGS, type SiteSettings, type SocialLinks } from "./types";

type Row = { key: string; value: unknown };

/**
 * Applies one stored row onto the settings object, driven by the
 * registry rather than a hand-written switch (Module 25).
 *
 * Keys the registry does not know about are ignored rather than throwing:
 * a future module's key, a typo, or a leftover row from a removed feature
 * (e.g. Module 3's `store.announcement_*`) must not break the whole
 * settings fetch and take the site down with it.
 */
function applyRow(settings: SiteSettings, row: Row) {
  // social_links is the one structured value and predates the registry,
  // which describes flat form inputs only.
  if (row.key === "store.social_links") {
    settings.store.socialLinks =
      row.value && typeof row.value === "object" ? (row.value as SocialLinks) : {};
    return;
  }

  const entry = findEntry(row.key);
  if (!entry) return;

  const [group, field] = entry.path;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const target = (settings as any)[group];
  if (!target) return;

  switch (entry.type) {
    case "boolean":
      // Tolerate the string form in case a row is written by hand via the
      // Supabase dashboard.
      target[field] = row.value === true || row.value === "true";
      break;
    case "number": {
      const parsed = typeof row.value === "number" ? row.value : Number(row.value);
      if (Number.isFinite(parsed)) target[field] = parsed;
      break;
    }
    case "select":
      // A stored value that is no longer a valid option (an option was
      // removed) falls back to the default rather than being applied —
      // otherwise the UI would show a blank select and the app would use
      // a value it no longer supports.
      if (typeof row.value === "string" && entry.options?.some((o) => o.value === row.value)) {
        target[field] = row.value;
      }
      break;
    default:
      target[field] = typeof row.value === "string" && row.value !== "" ? row.value : null;
      break;
  }
}

/**
 * Homepage keys predate the registry and are edited on the homepage
 * screen rather than in Settings, so they are not registry entries but
 * still need reading.
 */
const LEGACY_STRING_KEYS: Record<string, [keyof SiteSettings, string]> = {
  "homepage.seo_title": ["homepage", "seoTitle"],
  "homepage.seo_description": ["homepage", "seoDescription"],
  "homepage.hero_heading": ["homepage", "heroHeading"],
  "homepage.hero_subheading": ["homepage", "heroSubheading"],
  "homepage.hero_image_url": ["homepage", "heroImageUrl"],
};

function applyLegacyRow(settings: SiteSettings, row: Row): boolean {
  const mapping = LEGACY_STRING_KEYS[row.key];
  if (!mapping) return false;
  const [group, field] = mapping;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (settings as any)[group][field] = typeof row.value === "string" ? row.value : null;
  return true;
}

/**
 * Fetches every site_settings row and merges it over the hardcoded
 * defaults into one typed object. Memoized per request (React cache)
 * since layout, header, footer, emails and the AI layer all read this
 * independently.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const settings: SiteSettings = structuredClone(DEFAULT_SITE_SETTINGS);

  const supabase = await createClient();
  const { data, error } = await supabase.from("site_settings").select("key, value");

  if (error) {
    logger.warn("failed to load site_settings, using defaults", { message: error.message });
    return settings;
  }

  for (const row of (data ?? []) as Row[]) {
    if (applyLegacyRow(settings, row)) continue;
    applyRow(settings, row);
  }
  return settings;
});

/** Every key this application knows how to read — used by the admin form and tests. */
export const KNOWN_SETTING_KEYS = [
  ...SETTINGS_REGISTRY.map((entry) => entry.key),
  "store.social_links",
  ...Object.keys(LEGACY_STRING_KEYS),
];

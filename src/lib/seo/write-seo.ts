import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import type { WriteResult } from "@/lib/orders/write-orders";
import { DEFAULT_SITE_SETTINGS } from "@/lib/settings/types";

/**
 * SEO WRITE services — Module 40.
 *
 * Extracted from `src/features/admin-seo/actions.ts` for the reason every
 * module since 38 has extracted its writers: the action builds its client
 * from request COOKIES, which an MCP Bearer call does not carry, so the
 * write would run anonymously and be refused by RLS.
 *
 * THE `seo.*` NAMESPACE IS THE BOUNDARY. `site_settings` is one key-value
 * table holding currency, theme colours, notification switches and the
 * SEO defaults. A service that took a key would be a tool that could
 * rewrite any setting in the application, which is the "no tool takes a
 * table name" rule of 12B.15 wearing a different disguise. The keys are
 * fixed here and the caller chooses values, never names.
 */

/** Every key this file may write. Nothing else in `site_settings` is reachable. */
const SEO_KEYS = {
  defaultTitle: "seo.default_title",
  defaultDescription: "seo.default_description",
  defaultOgImageUrl: "seo.default_og_image_url",
  twitterHandle: "seo.twitter_handle",
  googleSiteVerification: "seo.google_site_verification",
} as const;

export type SeoDefaultsPatch = Partial<Record<keyof typeof SEO_KEYS, string | null>>;

/**
 * Writes the site-wide SEO defaults.
 *
 * OMISSION IS NOT DELETION, the rule Module 38 set. The admin form posts
 * every field, so a blank there honestly means "clear this". A tool call
 * setting the default title would otherwise wipe the description, the OG
 * image and the Google verification token — and losing the verification
 * token silently unverifies the site. An explicit `null` still clears.
 *
 * `indexingEnabled` is NOT here. Turning indexing off delists the whole
 * site from search, which is a different order of consequence from
 * editing a title, and `risk` is declared per tool — so it is its own
 * high-risk tool. See `setIndexingEnabled`.
 */
export async function updateSeoDefaultsRecord(
  patch: SeoDefaultsPatch,
  client: SupabaseClient
): Promise<WriteResult<{ updated: string[]; cleared: string[] }>> {
  const upserts: { key: string; value: string }[] = [];
  const deletes: string[] = [];

  for (const [field, key] of Object.entries(SEO_KEYS) as [keyof typeof SEO_KEYS, string][]) {
    const value = patch[field];
    if (value === undefined) continue;
    // An empty row would be stored as "" and shadow the fallback in
    // `siteConfig`; the existing action deletes instead, and so does this.
    if (value === null || value === "") deletes.push(key);
    else upserts.push({ key, value });
  }

  if (upserts.length === 0 && deletes.length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  if (upserts.length > 0) {
    const { error } = await client.from("site_settings").upsert(upserts, { onConflict: "key" });
    if (error) {
      logger.error("seo defaults update failed", error);
      return { ok: false, error: "Could not save these settings." };
    }
  }

  if (deletes.length > 0) {
    const { error } = await client.from("site_settings").delete().in("key", deletes);
    if (error) {
      logger.error("seo defaults clear failed", error);
      return { ok: false, error: "Could not clear the empty fields." };
    }
  }

  return {
    ok: true,
    data: { updated: upserts.map((u) => u.key), cleared: deletes },
  };
}

/**
 * Turns search-engine indexing on or off for the entire site.
 *
 * Its own function, and its own high-risk tool, because this is the one
 * SEO setting whose blast radius is the whole business: switched off, the
 * site drops out of Google, and it does not come back the moment somebody
 * switches it on again. Bundled into the editor it would be an
 * unconfirmed delisting tool wearing the name of a title change — the
 * same reasoning that split `products_publish` in Module 38.
 */
export async function setIndexingEnabled(
  enabled: boolean,
  client: SupabaseClient
): Promise<WriteResult<{ indexingEnabled: boolean; previous: boolean }>> {
  const { data: existing } = await client
    .from("site_settings")
    .select("value")
    .eq("key", "seo.indexing_enabled")
    .maybeSingle();

  // An absent row means the DEFAULT, and the default is not "indexed" —
  // `DEFAULT_SITE_SETTINGS.seo.indexingEnabled` is false, which is the
  // right call for a site that has not launched. Read from that constant
  // rather than restating it: this function reporting a different
  // "previous" from the one `getSiteSettings()` reports would make the
  // confirmation prompt describe a change that is not the one happening.
  const previous =
    existing?.value === undefined
      ? DEFAULT_SITE_SETTINGS.seo.indexingEnabled
      : existing.value !== false;

  const { error } = await client
    .from("site_settings")
    .upsert({ key: "seo.indexing_enabled", value: enabled }, { onConflict: "key" });

  if (error) {
    logger.error("seo indexing toggle failed", error);
    return { ok: false, error: "Could not change the indexing setting." };
  }

  return { ok: true, data: { indexingEnabled: enabled, previous } };
}

export type SeoOverridePatch = {
  entityType: "product" | "collection" | "page" | "blog_post";
  entityId: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImageUrl?: string | null;
  canonicalUrl?: string | null;
};

/**
 * Creates or edits one entity's SEO override.
 *
 * The existing action UPSERTS all four columns, which is right for a form
 * that posts all four and wrong for a tool that sends one — the other
 * three would be nulled by omission. So the stored row is read and merged
 * onto first, the same shape Module 38 used for `upsertSeoMetadata`.
 *
 * `entityType` is a domain enum, not a table name: it is stored in the
 * `seo_metadata.entity_type` column and reaches no query builder as an
 * identifier. 12B.15 holds.
 */
export async function saveSeoOverrideRecord(
  patch: SeoOverridePatch,
  client: SupabaseClient
): Promise<WriteResult<{ entityType: string; entityId: string; created: boolean }>> {
  const { data: existing } = await client
    .from("seo_metadata")
    .select("meta_title, meta_description, og_image_url, canonical_url")
    .eq("entity_type", patch.entityType)
    .eq("entity_id", patch.entityId)
    .maybeSingle();

  const merged = {
    entity_type: patch.entityType,
    entity_id: patch.entityId,
    meta_title: patch.metaTitle === undefined ? (existing?.meta_title ?? null) : patch.metaTitle || null,
    meta_description:
      patch.metaDescription === undefined
        ? (existing?.meta_description ?? null)
        : patch.metaDescription || null,
    og_image_url:
      patch.ogImageUrl === undefined ? (existing?.og_image_url ?? null) : patch.ogImageUrl || null,
    canonical_url:
      patch.canonicalUrl === undefined ? (existing?.canonical_url ?? null) : patch.canonicalUrl || null,
  };

  const { error } = await client
    .from("seo_metadata")
    .upsert(merged, { onConflict: "entity_type,entity_id" });

  if (error) {
    logger.error("seo override save failed", error, { entityType: patch.entityType });
    return { ok: false, error: "Could not save this SEO override." };
  }

  return {
    ok: true,
    data: { entityType: patch.entityType, entityId: patch.entityId, created: !existing },
  };
}

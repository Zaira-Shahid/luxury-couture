"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { seoDefaultsSchema, seoOverrideSchema } from "@/lib/validations/seo";

export type ActionResult = { error: string } | undefined;

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

/**
 * Writes the site-wide SEO keys into `site_settings`.
 *
 * Deliberately scoped to the `seo.*` namespace only — Module 25 owns the
 * full admin settings screen, and a generic "write any key" action would
 * pre-empt it while handing the client control over which key it writes.
 * An empty field deletes its row rather than storing "", so
 * `getSiteSettings()` falls back through to `siteConfig` as designed.
 *
 * Authorization is RLS: `site_settings` is admin-only for all operations
 * (0012), on top of the (admin) layout's role guard.
 */
export async function updateSeoDefaults(formData: FormData): Promise<ActionResult> {
  const parsed = seoDefaultsSchema.safeParse({
    defaultTitle: formData.get("defaultTitle") || "",
    defaultDescription: formData.get("defaultDescription") || "",
    defaultOgImageUrl: formData.get("defaultOgImageUrl") || "",
    twitterHandle: formData.get("twitterHandle") || "",
    googleSiteVerification: formData.get("googleSiteVerification") || "",
    indexingEnabled: formData.get("indexingEnabled") === "on",
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const entries: { key: string; value: string | boolean }[] = [
    { key: "seo.default_title", value: parsed.data.defaultTitle ?? "" },
    { key: "seo.default_description", value: parsed.data.defaultDescription ?? "" },
    { key: "seo.default_og_image_url", value: parsed.data.defaultOgImageUrl ?? "" },
    { key: "seo.twitter_handle", value: parsed.data.twitterHandle ?? "" },
    { key: "seo.google_site_verification", value: parsed.data.googleSiteVerification ?? "" },
    { key: "seo.indexing_enabled", value: parsed.data.indexingEnabled },
  ];

  const toUpsert = entries.filter((e) => e.value !== "");
  const toDelete = entries.filter((e) => e.value === "").map((e) => e.key);

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("site_settings")
      .upsert(toUpsert, { onConflict: "key" });
    if (error) {
      logger.error("seo defaults update failed", error);
      return { error: "Could not save these settings." };
    }
  }
  if (toDelete.length > 0) {
    const { error } = await supabase.from("site_settings").delete().in("key", toDelete);
    if (error) {
      logger.error("seo defaults clear failed", error);
      return { error: "Could not clear the empty fields." };
    }
  }

  // Site-wide metadata touches every route, so revalidate the layout.
  revalidatePath("/", "layout");
  revalidatePath("/admin/seo");
  return undefined;
}

/**
 * Creates or replaces one entity's `seo_metadata` row. The table has a
 * unique (entity_type, entity_id) constraint from 0011, so upsert on that
 * pair is the natural write — one override per entity, never duplicates.
 */
export async function saveSeoOverride(formData: FormData): Promise<ActionResult> {
  const parsed = seoOverrideSchema.safeParse({
    entityType: formData.get("entityType"),
    entityId: formData.get("entityId"),
    metaTitle: formData.get("metaTitle") || "",
    metaDescription: formData.get("metaDescription") || "",
    ogImageUrl: formData.get("ogImageUrl") || "",
    canonicalUrl: formData.get("canonicalUrl") || "",
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("seo_metadata").upsert(
    {
      entity_type: parsed.data.entityType,
      entity_id: parsed.data.entityId,
      meta_title: parsed.data.metaTitle || null,
      meta_description: parsed.data.metaDescription || null,
      og_image_url: parsed.data.ogImageUrl || null,
      canonical_url: parsed.data.canonicalUrl || null,
    },
    { onConflict: "entity_type,entity_id" }
  );
  if (error) {
    logger.error("seo override save failed", error, { entityType: parsed.data.entityType });
    return { error: "Could not save this SEO override." };
  }

  revalidatePath("/admin/seo");
  revalidatePath("/", "layout");
  return undefined;
}

export async function deleteSeoOverride(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("seo_metadata").delete().eq("id", id);
  if (error) {
    logger.error("seo override delete failed", error, { id });
    return { error: "Could not delete this override." };
  }

  revalidatePath("/admin/seo");
  revalidatePath("/", "layout");
  return undefined;
}

"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import {
  saveSeoOverrideRecord,
  setIndexingEnabled,
  updateSeoDefaultsRecord,
} from "@/lib/seo/write-seo";
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

  // The form posts every field, so passing them all preserves its
  // "blank clears the row" behaviour exactly. A tool omitting a field
  // means "leave it alone", which the service distinguishes.
  const result = await updateSeoDefaultsRecord(
    {
      defaultTitle: parsed.data.defaultTitle ?? "",
      defaultDescription: parsed.data.defaultDescription ?? "",
      defaultOgImageUrl: parsed.data.defaultOgImageUrl ?? "",
      twitterHandle: parsed.data.twitterHandle ?? "",
      googleSiteVerification: parsed.data.googleSiteVerification ?? "",
    },
    supabase
  );
  if (!result.ok) return { error: result.error };

  // Indexing is a separate service call because it is a separate tool —
  // see lib/seo/write-seo.ts. This form still saves both together, as it
  // always has.
  const indexing = await setIndexingEnabled(parsed.data.indexingEnabled, supabase);
  if (!indexing.ok) return { error: indexing.error };

  // Site-wide metadata touches every route, so revalidate the layout.
  revalidatePath("/", "layout");
  revalidatePath("/admin/seo");
  return undefined;
}

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
  const result = await saveSeoOverrideRecord(
    {
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      metaTitle: parsed.data.metaTitle ?? "",
      metaDescription: parsed.data.metaDescription ?? "",
      ogImageUrl: parsed.data.ogImageUrl ?? "",
      canonicalUrl: parsed.data.canonicalUrl ?? "",
    },
    supabase
  );
  if (!result.ok) return { error: result.error };

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

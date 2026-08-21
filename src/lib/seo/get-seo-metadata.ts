import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { SeoMetadata, UUID } from "@/types/database";

/**
 * The entities an admin can attach SEO overrides to. `seo_metadata` is a
 * polymorphic table (`entity_type` + `entity_id`, unique together) created
 * back in Module 1 — this union is the app-side allow-list so a typo can't
 * silently write rows nothing will ever read back.
 */
export const SEO_ENTITY_TYPES = ["product", "collection", "page", "blog_post"] as const;
export type SeoEntityType = (typeof SEO_ENTITY_TYPES)[number];

/**
 * Admin-authored SEO overrides for one entity, or null when none exist —
 * which is the normal case, so every caller must degrade gracefully to the
 * entity's own fields. Memoized per request because a page's
 * `generateMetadata` and its component tree both reach for the same row.
 */
export const getSeoMetadata = cache(
  async (entityType: SeoEntityType, entityId: UUID): Promise<SeoMetadata | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("seo_metadata")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .maybeSingle();

    if (error) {
      logger.warn("failed to load seo_metadata", { message: error.message, entityType, entityId });
      return null;
    }
    return data as SeoMetadata | null;
  }
);

/**
 * Bulk variant for admin list screens — one query instead of N. Returns a
 * map keyed by entity_id.
 */
export const getSeoMetadataByType = cache(
  async (entityType: SeoEntityType): Promise<Map<UUID, SeoMetadata>> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("seo_metadata")
      .select("*")
      .eq("entity_type", entityType);

    if (error) {
      logger.warn("failed to load seo_metadata list", { message: error.message, entityType });
      return new Map();
    }
    return new Map((data as SeoMetadata[]).map((row) => [row.entity_id, row]));
  }
);

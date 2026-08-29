import { createClient } from "@/lib/supabase/server";
import { readFailed, readerClient, type ReaderOptions } from "@/lib/supabase/reader";
import { logger } from "@/lib/logger";
import type { PromotionalBanner } from "@/types/database";

// ReaderOptions added in Module 40, when the MCP content tools became the
// first caller of these readers that is not a page render. Omitting the
// argument keeps the existing page behaviour exactly — see
// lib/supabase/reader.ts for why a tool must pass its own client.
export async function getAdminBanners(options?: ReaderOptions): Promise<PromotionalBanner[]> {
  const supabase = await readerClient(options);
  const { data, error } = await supabase
    .from("promotional_banners")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return readFailed(error, options, [], "failed to load promotional banners");
  return (data ?? []) as PromotionalBanner[];
}

export async function getAdminBanner(
  id: string,
  options?: ReaderOptions
): Promise<PromotionalBanner | null> {
  const supabase = await readerClient(options);
  const { data, error } = await supabase.from("promotional_banners").select("*").eq("id", id).maybeSingle();

  if (error) return readFailed(error, options, null, "failed to load promotional banner", { id });
  return (data ?? null) as PromotionalBanner | null;
}

/**
 * The single highest-priority (lowest sort_order) currently-active,
 * currently-in-schedule banner — shown by SiteHeader instead of stacking
 * every active banner at once. is_active is enforced by RLS itself; the
 * schedule window (starts_at/expires_at) is enforced here, same as
 * coupons' own starts_at/expires_at handling.
 */
export async function getCurrentBanner(): Promise<PromotionalBanner | null> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("promotional_banners")
    .select("*")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn("failed to load current promotional banner", { message: error.message });
    return null;
  }
  return (data ?? null) as PromotionalBanner | null;
}

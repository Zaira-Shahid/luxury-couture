import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { PromotionalBanner } from "@/types/database";

export async function getAdminBanners(): Promise<PromotionalBanner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotional_banners")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    logger.warn("failed to load promotional banners", { message: error.message });
    return [];
  }
  return (data ?? []) as PromotionalBanner[];
}

export async function getAdminBanner(id: string): Promise<PromotionalBanner | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("promotional_banners").select("*").eq("id", id).maybeSingle();

  if (error) {
    logger.warn("failed to load promotional banner", { id, message: error.message });
    return null;
  }
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

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Campaign } from "@/types/database";

export async function getAdminCampaigns(): Promise<Campaign[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load campaigns", { message: error.message });
    return [];
  }
  return (data ?? []) as Campaign[];
}

export async function getAdminCampaign(id: string): Promise<Campaign | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();

  if (error) {
    logger.warn("failed to load campaign", { id, message: error.message });
    return null;
  }
  return (data ?? null) as Campaign | null;
}

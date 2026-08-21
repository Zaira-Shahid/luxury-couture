import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { InventoryItem } from "@/types/database";

export async function getAdminInventoryItems(): Promise<InventoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    logger.warn("failed to load inventory items", { message: error.message });
    return [];
  }
  return (data ?? []) as InventoryItem[];
}

export async function getAdminInventoryItem(id: string): Promise<InventoryItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("inventory_items").select("*").eq("id", id).maybeSingle();

  if (error) {
    logger.warn("failed to load inventory item", { id, message: error.message });
    return null;
  }
  return (data ?? null) as InventoryItem | null;
}

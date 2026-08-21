import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { BUILDER_OPTION_TABLES, type BuilderOptionTable } from "@/types/database";

export function isBuilderOptionTable(value: string): value is BuilderOptionTable {
  return (BUILDER_OPTION_TABLES as readonly string[]).includes(value);
}

/**
 * Admin-scoped: every row including inactive ones, unlike the storefront
 * teaser (lib/catalog/get-builder-options.ts) which only shows active
 * rows. All six option tables share an identical shape (Colour swaps
 * description for hex_value) and identical RLS, so one generic function
 * covers all of them rather than six near-duplicates.
 */
export async function getAdminOptionRows<T>(table: BuilderOptionTable): Promise<T[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).select("*").order("sort_order", { ascending: true });

  if (error) {
    logger.warn("failed to load admin builder options", { table, message: error.message });
    return [];
  }
  return (data ?? []) as T[];
}

export async function getAdminOptionRow<T>(table: BuilderOptionTable, id: string): Promise<T | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();

  if (error) {
    logger.warn("failed to load admin builder option", { table, id, message: error.message });
    return null;
  }
  return (data ?? null) as T | null;
}

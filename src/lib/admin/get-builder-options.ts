import { readFailed, readerClient, type ReaderOptions } from "@/lib/supabase/reader";
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
export async function getAdminOptionRows<T>(
  table: BuilderOptionTable,
  options?: ReaderOptions
): Promise<T[]> {
  const supabase = await readerClient(options);
  const { data, error } = await supabase.from(table).select("*").order("sort_order", { ascending: true });

  if (error) {
    return readFailed(error, options, [] as T[], "failed to load admin builder options", { table });
  }
  return (data ?? []) as T[];
}

export async function getAdminOptionRow<T>(
  table: BuilderOptionTable,
  id: string,
  options?: ReaderOptions
): Promise<T | null> {
  const supabase = await readerClient(options);
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();

  if (error) {
    return readFailed(error, options, null as T | null, "failed to load admin builder option", {
      table,
      id,
    });
  }
  return (data ?? null) as T | null;
}

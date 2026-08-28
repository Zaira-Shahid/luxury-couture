import { readFailed, readerClient, type ReaderOptions } from "@/lib/supabase/reader";
import type { Collection, Product } from "@/types/database";

/**
 * Admin-scoped catalogue readers — every product and collection whatever
 * its status, unlike the storefront readers in `get-products.ts` and
 * `get-collections.ts` which return published/active rows only.
 *
 * EXTRACTED IN MODULE 37, not written fresh. These two queries lived
 * inline inside `app/(admin)/admin/products/page.tsx` and
 * `.../collections/page.tsx`, which was fine while a page was the only
 * caller. The MCP read tools are the second caller, and Master Build Plan
 * 12B.11 forbids a tool reimplementing a query a page already owns — so
 * the query moved here and both callers use it. The pages behave exactly
 * as they did; they just no longer own the query.
 *
 * A single record is fetched by SLUG for products (the storefront's key,
 * and what an assistant is most likely to be given) and by ID for both —
 * see `getAdminProduct`/`getAdminCollection`.
 */

export async function getAdminProducts(options?: ReaderOptions): Promise<Product[]> {
  const supabase = await readerClient(options);
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return readFailed(error, options, [], "failed to load admin products");
  return (data ?? []) as Product[];
}

export async function getAdminProduct(
  id: string,
  options?: ReaderOptions
): Promise<Product | null> {
  const supabase = await readerClient(options);
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();

  if (error) return readFailed(error, options, null, "failed to load admin product", { id });
  return (data ?? null) as Product | null;
}

export async function getAdminCollections(options?: ReaderOptions): Promise<Collection[]> {
  const supabase = await readerClient(options);
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return readFailed(error, options, [], "failed to load admin collections");
  return (data ?? []) as Collection[];
}

export async function getAdminCollection(
  id: string,
  options?: ReaderOptions
): Promise<Collection | null> {
  const supabase = await readerClient(options);
  const { data, error } = await supabase.from("collections").select("*").eq("id", id).maybeSingle();

  if (error) return readFailed(error, options, null, "failed to load admin collection", { id });
  return (data ?? null) as Collection | null;
}

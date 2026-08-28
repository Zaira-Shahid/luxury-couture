import { readFailed, readerClient, type ReaderOptions } from "@/lib/supabase/reader";
import type { ProductionOrder, ProductionStatusHistoryEntry } from "@/types/database";

export type ProductionOrderWithOrder = ProductionOrder & {
  orders: { order_number: string } | null;
};

export type ProductionOrderDetail = {
  production: ProductionOrder;
  order: { id: string; order_number: string } | null;
  history: ProductionStatusHistoryEntry[];
};

/**
 * Every production order — RLS scopes this to admin or 'production'-role
 * accounts (0034); a customer or plain 'staff' account gets nothing back.
 */
export async function getAdminProductionOrders(
  options?: ReaderOptions
): Promise<ProductionOrderWithOrder[]> {
  const supabase = await readerClient(options);
  const { data, error } = await supabase
    .from("production_orders")
    .select("*, orders(order_number)")
    .order("created_at", { ascending: false });

  if (error) return readFailed(error, options, [], "failed to load production orders");
  return (data ?? []) as unknown as ProductionOrderWithOrder[];
}

export async function getProductionOrderDetail(
  id: string,
  options?: ReaderOptions
): Promise<ProductionOrderDetail | null> {
  const supabase = await readerClient(options);
  const [productionResult, historyResult] = await Promise.all([
    supabase.from("production_orders").select("*, orders(id, order_number)").eq("id", id).single(),
    supabase.from("production_status_history").select("*").eq("production_order_id", id).order("created_at"),
  ]);

  if (productionResult.error || !productionResult.data) {
    if (productionResult.error && options?.throwOnError) throw productionResult.error;
    return null;
  }
  const { orders, ...production } = productionResult.data as ProductionOrder & {
    orders: { id: string; order_number: string } | null;
  };

  return {
    production: production as ProductionOrder,
    order: orders,
    history: (historyResult.data ?? []) as ProductionStatusHistoryEntry[],
  };
}

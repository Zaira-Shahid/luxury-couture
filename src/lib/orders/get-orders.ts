import { createClient } from "@/lib/supabase/server";
import { readFailed, readerClient, type ReaderOptions } from "@/lib/supabase/reader";
import { logger } from "@/lib/logger";
import type {
  Address,
  Order,
  OrderItem,
  OrderNote,
  OrderStatusHistoryEntry,
  Payment,
  ProductionOrder,
  ProductionStatusHistoryEntry,
  ShippingEvent,
  ShippingOrder,
} from "@/types/database";

export type AdminOrder = Order & { profiles: { full_name: string | null } | null };

export type OrderDetail = {
  order: Order;
  items: OrderItem[];
  payments: Payment[];
  statusHistory: OrderStatusHistoryEntry[];
  production: ProductionOrder | null;
  productionHistory: ProductionStatusHistoryEntry[];
  shipping: ShippingOrder | null;
  shippingEvents: ShippingEvent[];
  address: Address | null;
};

export type AdminOrderDetail = OrderDetail & {
  customer: { full_name: string | null } | null;
  notes: OrderNote[];
};

/** The signed-in customer's own orders. */
export async function getMyOrders(): Promise<Order[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load orders", { message: error.message });
    return [];
  }
  return (data ?? []) as Order[];
}

/** Admin-only: every order. */
export async function getAdminOrders(options?: ReaderOptions): Promise<AdminOrder[]> {
  const supabase = await readerClient(options);
  const { data, error } = await supabase
    .from("orders")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false });

  if (error) return readFailed(error, options, [], "failed to load admin orders");
  return (data ?? []) as unknown as AdminOrder[];
}

/**
 * A single order + everything shown alongside it, by id. Works for both
 * the owning customer and an admin — RLS (owner-or-admin) gates each
 * table, not this query. production_orders/shipping_orders are queried
 * with .maybeSingle() rather than embedded, since order_id is unique on
 * both (at most one row) and this avoids any ambiguity in how PostgREST
 * would serialize a to-one embedded relation.
 */
export async function getOrderDetail(
  id: string,
  options?: ReaderOptions
): Promise<OrderDetail | null> {
  const supabase = await readerClient(options);

  const [orderResult, itemsResult, paymentsResult, historyResult, productionResult, shippingResult] =
    await Promise.all([
      supabase.from("orders").select("*").eq("id", id).single(),
      supabase.from("order_items").select("*").eq("order_id", id).order("created_at"),
      supabase.from("payments").select("*").eq("order_id", id).order("created_at"),
      supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at"),
      supabase.from("production_orders").select("*").eq("order_id", id).maybeSingle(),
      supabase.from("shipping_orders").select("*").eq("order_id", id).maybeSingle(),
    ]);

  if (orderResult.error || !orderResult.data) {
    // A missing row is not a failure — .single() reports PGRST116 for
    // "no rows", which a tool must surface as NOT_FOUND rather than as an
    // internal fault, and which a page renders as its own 404.
    if (orderResult.error && options?.throwOnError) throw orderResult.error;
    return null;
  }
  const order = orderResult.data as Order;

  const addressResult = order.shipping_address_id
    ? await supabase.from("addresses").select("*").eq("id", order.shipping_address_id).maybeSingle()
    : null;

  const production = (productionResult.data ?? null) as ProductionOrder | null;
  const productionHistoryResult = production
    ? await supabase
        .from("production_status_history")
        .select("*")
        .eq("production_order_id", production.id)
        .order("created_at")
    : null;

  const shipping = (shippingResult.data ?? null) as ShippingOrder | null;
  const shippingEventsResult = shipping
    ? await supabase.from("shipping_events").select("*").eq("shipping_order_id", shipping.id).order("occurred_at")
    : null;

  return {
    order,
    items: (itemsResult.data ?? []) as OrderItem[],
    payments: (paymentsResult.data ?? []) as Payment[],
    statusHistory: (historyResult.data ?? []) as OrderStatusHistoryEntry[],
    production,
    productionHistory: (productionHistoryResult?.data ?? []) as ProductionStatusHistoryEntry[],
    shipping,
    shippingEvents: (shippingEventsResult?.data ?? []) as ShippingEvent[],
    address: (addressResult?.data ?? null) as Address | null,
  };
}

/** Admin-only: order detail plus the customer's name and private internal notes. */
export async function getAdminOrderDetail(
  id: string,
  options?: ReaderOptions
): Promise<AdminOrderDetail | null> {
  const supabase = await readerClient(options);
  const [detail, profileResult, notesResult] = await Promise.all([
    getOrderDetail(id, options),
    supabase.from("orders").select("customer_id").eq("id", id).single(),
    supabase.from("order_notes").select("*").eq("order_id", id).order("created_at", { ascending: false }),
  ]);
  if (!detail) return null;

  let customer: { full_name: string | null } | null = null;
  if (profileResult.data?.customer_id) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", profileResult.data.customer_id)
      .maybeSingle();
    customer = data;
  }

  return { ...detail, customer, notes: (notesResult.data ?? []) as OrderNote[] };
}

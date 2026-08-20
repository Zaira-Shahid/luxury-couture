import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { ShippingEvent, ShippingOrder } from "@/types/database";

export type ShippingOrderWithOrder = ShippingOrder & {
  orders: { order_number: string } | null;
};

export type ShippingOrderDetail = {
  shipping: ShippingOrder;
  order: { id: string; order_number: string } | null;
  events: ShippingEvent[];
};

/** Admin-only: every shipment. */
export async function getAdminShippingOrders(): Promise<ShippingOrderWithOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipping_orders")
    .select("*, orders(order_number)")
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load shipping orders", { message: error.message });
    return [];
  }
  return (data ?? []) as unknown as ShippingOrderWithOrder[];
}

export async function getShippingOrderDetail(id: string): Promise<ShippingOrderDetail | null> {
  const supabase = await createClient();
  const [shippingResult, eventsResult] = await Promise.all([
    supabase.from("shipping_orders").select("*, orders(id, order_number)").eq("id", id).single(),
    supabase.from("shipping_events").select("*").eq("shipping_order_id", id).order("occurred_at"),
  ]);

  if (shippingResult.error || !shippingResult.data) return null;
  const { orders, ...shipping } = shippingResult.data as ShippingOrder & {
    orders: { id: string; order_number: string } | null;
  };

  return {
    shipping: shipping as ShippingOrder,
    order: orders,
    events: (eventsResult.data ?? []) as ShippingEvent[],
  };
}

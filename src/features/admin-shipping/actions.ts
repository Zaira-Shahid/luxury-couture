"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { notify } from "@/lib/notifications/notify";
import { deliveredTemplate, reviewRequestTemplate, shippedTemplate, shippingStatusChangedTemplate } from "@/lib/notifications/templates";
import { getShippingProvider } from "@/lib/shipping";
import { createClient } from "@/lib/supabase/server";
import { advanceShippingStatusSchema, updateShippingDetailsSchema } from "@/lib/validations/shipping";

export type ActionResult = { error: string } | { success: true };

/**
 * shipping_orders/shipping_events are admin-write-only by RLS (0008) — no
 * shipping-specific staff role exists, so this relies entirely on the
 * regular RLS-respecting client + is_admin(), same as every admin action
 * before Module 13's production carve-out.
 */
export async function createShipment(orderId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("shipping_orders")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing) return { error: "This order already has a shipment." };

  const { data: order } = await supabase.from("orders").select("shipping_address_id").eq("id", orderId).single();
  if (!order?.shipping_address_id) return { error: "This order has no shipping address on file." };

  const { data: address } = await supabase
    .from("addresses")
    .select("city, region, postal_code, country")
    .eq("id", order.shipping_address_id)
    .single();
  if (!address) return { error: "Shipping address not found." };

  const shipment = await getShippingProvider().createShipment({
    city: address.city,
    region: address.region,
    postalCode: address.postal_code,
    country: address.country,
  });

  const { error } = await supabase.from("shipping_orders").insert({
    order_id: orderId,
    address_id: order.shipping_address_id,
    courier: shipment.courier,
    tracking_number: shipment.trackingNumber,
    shipping_cost: shipment.cost,
  });
  if (error) {
    logger.error("shipment creation failed", error, { orderId });
    return { error: "Could not create a shipment. Please try again." };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/account/orders/${orderId}`);
  return { success: true };
}

export async function advanceShippingStatus(shippingOrderId: string, formData: FormData): Promise<ActionResult> {
  const parsed = advanceShippingStatusSchema.safeParse({
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return { error: "You must be signed in." };

  const { data: shipping } = await supabase
    .from("shipping_orders")
    .select("order_id, shipped_at, delivered_at, courier, tracking_number")
    .eq("id", shippingOrderId)
    .single();
  if (!shipping) return { error: "Shipment not found." };

  const isNewlyShipped = parsed.data.status !== "pending" && !shipping.shipped_at;
  const isNewlyDelivered = parsed.data.status === "delivered" && !shipping.delivered_at;

  const updates: Record<string, unknown> = { status: parsed.data.status };
  if (isNewlyShipped) updates.shipped_at = new Date().toISOString();
  if (isNewlyDelivered) updates.delivered_at = new Date().toISOString();

  const { error: updateErr } = await supabase.from("shipping_orders").update(updates).eq("id", shippingOrderId);
  if (updateErr) {
    logger.error("shipping status update failed", updateErr, { shippingOrderId });
    return { error: "Could not update shipping status. Please try again." };
  }

  await supabase.from("shipping_events").insert({
    shipping_order_id: shippingOrderId,
    status: parsed.data.status,
    description: parsed.data.note ?? null,
  });

  const { data: order } = await supabase
    .from("orders")
    .select("customer_id, order_number")
    .eq("id", shipping.order_id)
    .single();
  if (order) {
    const template = isNewlyShipped
      ? shippedTemplate(order.order_number, shipping.courier, shipping.tracking_number)
      : isNewlyDelivered
        ? deliveredTemplate(order.order_number)
        : shippingStatusChangedTemplate(order.order_number, parsed.data.status);
    await notify(supabase, { profileId: order.customer_id, ...template });

    if (isNewlyDelivered) {
      await notify(supabase, { profileId: order.customer_id, ...reviewRequestTemplate(order.order_number) });
    }
  }

  revalidatePath(`/admin/shipping/${shippingOrderId}`);
  revalidatePath(`/account/orders/${shipping.order_id}`);
  return { success: true };
}

export async function updateShippingDetails(shippingOrderId: string, formData: FormData): Promise<ActionResult> {
  const parsed = updateShippingDetailsSchema.safeParse({
    courier: formData.get("courier") || undefined,
    trackingNumber: formData.get("trackingNumber") || undefined,
  });
  if (!parsed.success) return { error: "Invalid input." };

  const supabase = await createClient();
  const { data: shipping } = await supabase
    .from("shipping_orders")
    .select("order_id")
    .eq("id", shippingOrderId)
    .single();
  if (!shipping) return { error: "Shipment not found." };

  const { error } = await supabase
    .from("shipping_orders")
    .update({
      courier: parsed.data.courier || null,
      tracking_number: parsed.data.trackingNumber || null,
    })
    .eq("id", shippingOrderId);
  if (error) {
    logger.error("shipping details update failed", error, { shippingOrderId });
    return { error: "Could not update these details. Please try again." };
  }

  revalidatePath(`/admin/shipping/${shippingOrderId}`);
  revalidatePath(`/account/orders/${shipping.order_id}`);
  return { success: true };
}

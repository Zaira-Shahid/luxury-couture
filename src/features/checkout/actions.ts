"use server";

import { redirect } from "next/navigation";

import { getCart } from "@/lib/cart/get-cart";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { placeOrderSchema } from "@/lib/validations/checkout";

export type ActionResult = { error: string } | { success: true };

/**
 * Turns the signed-in customer's cart into a real order. orders/order_items/
 * payments are admin-write-only by RLS (0007's own design intent — "all
 * writes happen server-side once prices/quantities/status have been
 * validated"), so this uses the service-role client for the actual insert,
 * only after independently re-deriving every price from products/
 * builder_configurations. cart_items.unit_price_snapshot (client-writable,
 * per its own column comment) is never read here — a tampered snapshot can
 * only mislead the cart UI, never the real charge.
 */
export async function placeOrder(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to check out." };

  const parsed = placeOrderSchema.safeParse({
    addressId: formData.get("addressId"),
    measurementProfileId: formData.get("measurementProfileId"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { data: address } = await supabase
    .from("addresses")
    .select("id")
    .eq("id", parsed.data.addressId)
    .eq("customer_id", user.id)
    .single();
  if (!address) return { error: "Choose a valid shipping address." };

  const { cart, items } = await getCart();
  if (items.length === 0) return { error: "Your cart is empty." };

  const hasCustomItem = items.some((item) => item.builder_configuration_id);
  if (hasCustomItem && !parsed.data.measurementProfileId) {
    return { error: "Choose a measurement profile for your custom design." };
  }
  if (parsed.data.measurementProfileId) {
    const { data: profile } = await supabase
      .from("measurement_profiles")
      .select("id")
      .eq("id", parsed.data.measurementProfileId)
      .eq("customer_id", user.id)
      .single();
    if (!profile) return { error: "Choose a valid measurement profile." };
  }

  const admin = createAdminClient();

  // Re-derive every price fresh, ignoring unit_price_snapshot entirely.
  const orderItemsInput: {
    product_id: string | null;
    builder_configuration_id: string | null;
    description_snapshot: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[] = [];

  for (const item of items) {
    if (item.product_id) {
      const { data: product } = await admin
        .from("products")
        .select("name, base_price")
        .eq("id", item.product_id)
        .single();
      if (!product) return { error: "One of your items is no longer available." };

      orderItemsInput.push({
        product_id: item.product_id,
        builder_configuration_id: null,
        description_snapshot: product.name,
        quantity: item.quantity,
        unit_price: product.base_price,
        line_total: Number((product.base_price * item.quantity).toFixed(2)),
      });
    } else if (item.builder_configuration_id) {
      const { data: config } = await admin
        .from("builder_configurations")
        .select("estimated_price, customer_id")
        .eq("id", item.builder_configuration_id)
        .single();
      if (!config || config.customer_id !== user.id) {
        return { error: "One of your custom designs is no longer available." };
      }

      const price = config.estimated_price ?? 0;
      orderItemsInput.push({
        product_id: null,
        builder_configuration_id: item.builder_configuration_id,
        description_snapshot: "Custom design",
        quantity: item.quantity,
        unit_price: price,
        line_total: Number((price * item.quantity).toFixed(2)),
      });
    }
  }

  const subtotal = Number(orderItemsInput.reduce((sum, i) => sum + i.line_total, 0).toFixed(2));

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      customer_id: user.id,
      measurement_profile_id: parsed.data.measurementProfileId,
      shipping_address_id: parsed.data.addressId,
      status: "pending",
      subtotal,
      total_amount: subtotal,
      notes: parsed.data.notes,
    })
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    logger.error("order creation failed", orderErr, { customerId: user.id });
    return { error: "Could not place your order. Please try again." };
  }

  const { error: itemsErr } = await admin
    .from("order_items")
    .insert(orderItemsInput.map((item) => ({ ...item, order_id: order.id })));
  if (itemsErr) {
    logger.error("order items creation failed", itemsErr, { orderId: order.id });
    return { error: "Could not place your order. Please try again." };
  }

  // No real payment processing yet — Module 11's job. This records that a
  // payment is owed, collectable manually/offline in the meantime.
  await admin.from("payments").insert({
    order_id: order.id,
    type: "full",
    amount: subtotal,
    status: "pending",
    provider: "manual",
  });

  await admin.from("carts").update({ status: "converted" }).eq("id", cart.id);

  redirect(`/checkout/confirmed/${order.order_number}`);
}

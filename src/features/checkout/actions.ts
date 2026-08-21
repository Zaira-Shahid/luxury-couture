"use server";

import { redirect } from "next/navigation";

import { getCart } from "@/lib/cart/get-cart";
import { trackServer } from "@/lib/analytics/track-server";
import { logger } from "@/lib/logger";
import { poundsToPoints, pointsToPounds } from "@/lib/loyalty/config";
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

  // Coupon and points redemption both happen before the order exists —
  // same "sequential awaits, best effort" risk model already accepted
  // throughout this function (e.g. a failed order_items insert after
  // orders succeeds isn't rolled back either). Never trusts a client-
  // computed discount: redeem_coupon re-validates against the real,
  // just-computed subtotal, and is the atomic, consuming version (locks
  // the coupon row) — never the read-only validate_coupon used for the
  // checkout preview.
  let discountAmount = 0;
  let couponId: string | null = null;
  if (parsed.data.couponCode) {
    const { data: couponResult, error: couponErr } = await admin.rpc("redeem_coupon", {
      p_code: parsed.data.couponCode,
      p_subtotal: subtotal,
    });
    if (couponErr) return { error: couponErr.message || "That coupon code isn't valid." };
    const row = couponResult?.[0];
    if (row) {
      couponId = row.coupon_id;
      discountAmount += Number(row.discount_amount);
    }
  }

  let pointsRedeemed = 0;
  if (parsed.data.redeemPoints) {
    const { data: loyaltyAccount } = await supabase
      .from("loyalty_accounts")
      .select("points_balance")
      .eq("customer_id", user.id)
      .maybeSingle();
    const availablePoints = loyaltyAccount?.points_balance ?? 0;
    const remainingAfterCoupon = Math.max(0, subtotal - discountAmount);
    const maxRedeemablePoints = poundsToPoints(remainingAfterCoupon);
    pointsRedeemed = Math.min(availablePoints, maxRedeemablePoints);

    if (pointsRedeemed > 0) {
      const { error: redeemErr } = await admin.rpc("redeem_loyalty_points", {
        p_customer_id: user.id,
        p_points: pointsRedeemed,
        p_reference: `checkout:${crypto.randomUUID()}`,
      });
      if (redeemErr) {
        logger.error("loyalty points redemption failed", redeemErr, { customerId: user.id });
        pointsRedeemed = 0;
      } else {
        discountAmount += pointsToPounds(pointsRedeemed);
      }
    }
  }

  const totalAmount = Number(Math.max(0, subtotal - discountAmount).toFixed(2));

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      customer_id: user.id,
      measurement_profile_id: parsed.data.measurementProfileId,
      shipping_address_id: parsed.data.addressId,
      status: "pending",
      subtotal,
      total_amount: totalAmount,
      balance_due_amount: totalAmount,
      discount_amount: discountAmount,
      coupon_id: couponId,
      loyalty_points_redeemed: pointsRedeemed,
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
    amount: totalAmount,
    status: "pending",
    provider: "manual",
  });

  await admin.from("carts").update({ status: "converted" }).eq("id", cart.id);

  // Before redirect() — it throws to unwind, so nothing after it runs.
  await trackServer(
    "purchase",
    {
      orderId: order.id,
      orderNumber: order.order_number,
      value: totalAmount,
      discount: discountAmount,
    },
    { profileId: user.id }
  );

  redirect(`/checkout/confirmed/${order.order_number}`);
}

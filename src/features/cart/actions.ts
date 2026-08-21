"use server";

import { revalidatePath } from "next/cache";

import { trackServer } from "@/lib/analytics/track-server";
import { logger } from "@/lib/logger";
import { getOrCreateCartSessionId } from "@/lib/cart/session";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true };

export async function addProductToCart(productId: string, quantity = 1): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("base_price")
    .eq("id", productId)
    .single();
  if (!product) return { error: "That product is no longer available." };

  const sessionId = await getOrCreateCartSessionId();
  const { error } = await supabase.rpc("add_cart_item", {
    p_session_id: sessionId,
    p_product_id: productId,
    p_quantity: quantity,
    // Display snapshot only — checkout re-derives the real price from
    // products.base_price, never trusts this value for the actual charge.
    p_unit_price: product.base_price,
  });

  if (error) {
    logger.error("add to cart failed", error, { productId });
    return { error: "Could not add that to your cart. Please try again." };
  }

  await trackServer("add_to_cart", {
    productId,
    value: Number(product.base_price),
    quantity,
  });

  revalidatePath("/cart");
  return { success: true };
}

export async function addBuilderConfigurationToCart(configurationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: config } = await supabase
    .from("builder_configurations")
    .select("estimated_price")
    .eq("id", configurationId)
    .single();
  if (!config) return { error: "That design was not found in your account." };

  const sessionId = await getOrCreateCartSessionId();
  const { error } = await supabase.rpc("add_cart_item", {
    p_session_id: sessionId,
    p_builder_configuration_id: configurationId,
    p_quantity: 1,
    p_unit_price: config.estimated_price ?? 0,
  });

  if (error) {
    logger.error("add builder configuration to cart failed", error, { configurationId });
    return { error: error.message.includes("Sign in") ? error.message : "Could not add that to your cart." };
  }

  await trackServer("add_to_cart", {
    configurationId,
    value: Number(config.estimated_price ?? 0),
    quantity: 1,
  });

  revalidatePath("/cart");
  return { success: true };
}

export async function updateCartItemQuantity(itemId: string, quantity: number): Promise<ActionResult> {
  const supabase = await createClient();
  const sessionId = await getOrCreateCartSessionId();

  const { error } = await supabase.rpc("update_cart_item_quantity", {
    p_item_id: itemId,
    p_session_id: sessionId,
    p_quantity: quantity,
  });

  if (error) {
    logger.error("cart quantity update failed", error, { itemId });
    return { error: "Could not update quantity. Please try again." };
  }

  revalidatePath("/cart");
  return { success: true };
}

export async function removeCartItem(itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const sessionId = await getOrCreateCartSessionId();

  const { error } = await supabase.rpc("remove_cart_item", {
    p_item_id: itemId,
    p_session_id: sessionId,
  });

  if (error) {
    logger.error("cart item remove failed", error, { itemId });
    return { error: "Could not remove that item. Please try again." };
  }

  revalidatePath("/cart");
  return { success: true };
}

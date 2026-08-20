import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { peekCartSessionId } from "@/lib/cart/session";
import type { Cart, CartItem, Product, ProductImage } from "@/types/database";

export type EnrichedCartItem = CartItem & {
  product: (Pick<Product, "id" | "name" | "slug" | "base_price" | "currency"> & {
    image_url: string | null;
  }) | null;
  builderConfigLabel: string | null;
};

export type CartWithItems = {
  cart: Cart;
  items: EnrichedCartItem[];
};

export async function getCart(): Promise<CartWithItems> {
  const supabase = await createClient();
  // Read-only: this runs from Server Component pages (/cart, /checkout,
  // the header), which can't call cookies().set(). Middleware guarantees
  // the cookie already exists by the time any page renders; this random
  // fallback only matters if something bypassed middleware entirely, and
  // just won't persist across requests in that edge case.
  const sessionId = (await peekCartSessionId()) ?? crypto.randomUUID();

  const { data: cart, error: cartErr } = await supabase.rpc("get_or_create_cart", {
    p_session_id: sessionId,
  });
  if (cartErr || !cart) {
    logger.error("failed to get or create cart", cartErr);
    throw new Error("Could not load your cart.");
  }

  const { data: rawItems, error: itemsErr } = await supabase.rpc("get_cart_items", {
    p_cart_id: cart.id,
    p_session_id: sessionId,
  });
  if (itemsErr) {
    logger.warn("failed to load cart items", { message: itemsErr.message });
    return { cart: cart as Cart, items: [] };
  }

  const items = (rawItems ?? []) as CartItem[];
  const productIds = items.map((i) => i.product_id).filter((id): id is string => !!id);
  const builderConfigIds = items
    .map((i) => i.builder_configuration_id)
    .filter((id): id is string => !!id);

  const [productsResult, imagesResult, configsResult] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("id, name, slug, base_price, currency").in("id", productIds)
      : Promise.resolve({ data: [] as Pick<Product, "id" | "name" | "slug" | "base_price" | "currency">[] }),
    productIds.length
      ? supabase
          .from("product_images")
          .select("product_id, url, is_primary")
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as Pick<ProductImage, "product_id" | "url" | "is_primary">[] }),
    builderConfigIds.length
      ? supabase.from("builder_configurations").select("id, fabric_id").in("id", builderConfigIds)
      : Promise.resolve({ data: [] as { id: string; fabric_id: string | null }[] }),
  ]);

  const productsById = new Map((productsResult.data ?? []).map((p) => [p.id, p]));
  const imagesByProduct = new Map<string, string>();
  for (const img of imagesResult.data ?? []) {
    if (img.is_primary || !imagesByProduct.has(img.product_id)) {
      imagesByProduct.set(img.product_id, img.url);
    }
  }

  const configs = configsResult.data ?? [];
  const fabricIds = configs.map((c) => c.fabric_id).filter((id): id is string => !!id);
  const { data: fabrics } = fabricIds.length
    ? await supabase.from("fabrics").select("id, name").in("id", fabricIds)
    : { data: [] as { id: string; name: string }[] };
  const fabricNameById = new Map((fabrics ?? []).map((f) => [f.id, f.name]));
  const configLabelsById = new Map(
    configs.map((c) => [
      c.id,
      c.fabric_id && fabricNameById.has(c.fabric_id)
        ? `Custom design — ${fabricNameById.get(c.fabric_id)}`
        : "Custom design",
    ])
  );

  const enriched: EnrichedCartItem[] = items.map((item) => ({
    ...item,
    product: item.product_id
      ? (() => {
          const p = productsById.get(item.product_id!);
          return p ? { ...p, image_url: imagesByProduct.get(p.id) ?? null } : null;
        })()
      : null,
    builderConfigLabel: item.builder_configuration_id
      ? (configLabelsById.get(item.builder_configuration_id) ?? "Custom design")
      : null,
  }));

  return { cart: cart as Cart, items: enriched };
}

/** Lightweight count for the header — skips the product/image/fabric enrichment getCart() does. */
export async function getCartItemCount(): Promise<number> {
  const sessionId = await peekCartSessionId();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && !sessionId) return 0;

  const { data: cart } = await supabase.rpc("get_or_create_cart", {
    p_session_id: sessionId,
  });
  if (!cart) return 0;

  const { data: items } = await supabase.rpc("get_cart_items", {
    p_cart_id: cart.id,
    p_session_id: sessionId,
  });
  return (items ?? []).reduce((sum: number, item: CartItem) => sum + item.quantity, 0);
}

import { cache } from "react";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { Product, UUID } from "@/types/database";

import type { AiRecommendation } from "./provider";

/**
 * Rules-based recommendation engine — the "rules-based recommendations"
 * development fallback the Master Build Plan asks for, and the ranking
 * used by every caller whether or not a model provider is configured.
 *
 * A ranked chain, each tier filling whatever slots remain:
 *   1. co-view affinity   (needs real traffic)
 *   2. co-purchase affinity (needs real orders)
 *   3. same category, nearest price
 *   4. same collection
 *   5. featured, then newest
 *
 * PRIVACY: tiers 1–2 are computed strictly as product→product aggregates.
 * We ask "which products appeared in the same session as this one", never
 * "what has this person looked at". No per-visitor profile is built or
 * stored. That keeps this inside the purpose disclosed in the consent
 * banner — "see which pages and products are useful, so we can improve
 * the site" — whereas per-person profiling from analytics-consented data
 * would exceed it and require its own consent.
 *
 * Tiers 1–2 return nothing on a new site, which is exactly why tiers 3–5
 * exist: this must produce good results on day one with zero traffic.
 */

/** Only sessions this recent contribute affinity, so ranking reflects the current catalogue. */
const AFFINITY_WINDOW_DAYS = 90;
/** Cap the rows pulled for the aggregate — this runs on a product page. */
const AFFINITY_ROW_LIMIT = 5000;
/** Tier 3 accepts products within ±this fraction of the source price. */
const PRICE_BAND = 0.4;

type Scored = { productId: UUID; reason: string };

function addUnique(into: Scored[], candidates: Scored[], excludeIds: Set<string>, limit: number) {
  for (const candidate of candidates) {
    if (into.length >= limit) return;
    if (excludeIds.has(candidate.productId)) continue;
    excludeIds.add(candidate.productId);
    into.push(candidate);
  }
}

/**
 * Products that appeared in the same analytics session as `productId`,
 * ranked by how many distinct sessions they co-occurred in.
 */
const getCoViewAffinity = cache(async (productId: UUID): Promise<Scored[]> => {
  const supabase = await createClient();
  const since = new Date(Date.now() - AFFINITY_WINDOW_DAYS * 86_400_000).toISOString();

  // Sessions that viewed this product. RLS on analytics_events is
  // admin-read-only, so this returns nothing for an anonymous storefront
  // visitor — the chain then degrades to the catalog tiers, which is the
  // correct and safe behaviour rather than an error.
  const { data: ownSessions, error: ownErr } = await supabase
    .from("analytics_events")
    .select("session_id")
    .eq("event_name", "product_view")
    .eq("properties->>productId", productId)
    .not("session_id", "is", null)
    .gte("occurred_at", since)
    .limit(AFFINITY_ROW_LIMIT);

  if (ownErr || !ownSessions?.length) return [];

  const sessionIds = [...new Set(ownSessions.map((r) => r.session_id as string))];
  if (sessionIds.length === 0) return [];

  const { data: coViews, error: coErr } = await supabase
    .from("analytics_events")
    .select("session_id, properties")
    .eq("event_name", "product_view")
    .in("session_id", sessionIds.slice(0, 1000))
    .gte("occurred_at", since)
    .limit(AFFINITY_ROW_LIMIT);

  if (coErr || !coViews?.length) return [];

  // Count DISTINCT sessions per co-viewed product, not raw views — one
  // visitor refreshing a page ten times must not outrank ten visitors.
  const sessionsByProduct = new Map<string, Set<string>>();
  for (const row of coViews) {
    const other = (row.properties as { productId?: string } | null)?.productId;
    if (!other || other === productId) continue;
    if (!sessionsByProduct.has(other)) sessionsByProduct.set(other, new Set());
    sessionsByProduct.get(other)!.add(row.session_id as string);
  }

  return [...sessionsByProduct.entries()]
    .map(([id, sessions]) => ({ id, count: sessions.size }))
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({
      productId: entry.id,
      reason: `Viewed in the same visit by ${entry.count} customer${entry.count === 1 ? "" : "s"}`,
    }));
});

/** Products bought in the same order as `productId`. */
const getCoPurchaseAffinity = cache(async (productId: UUID): Promise<Scored[]> => {
  const supabase = await createClient();

  const { data: ownOrders, error: ownErr } = await supabase
    .from("order_items")
    .select("order_id")
    .eq("product_id", productId)
    .limit(AFFINITY_ROW_LIMIT);

  if (ownErr || !ownOrders?.length) return [];

  const orderIds = [...new Set(ownOrders.map((r) => r.order_id as string))];
  const { data: siblings, error: sibErr } = await supabase
    .from("order_items")
    .select("product_id")
    .in("order_id", orderIds.slice(0, 1000))
    .not("product_id", "is", null)
    .limit(AFFINITY_ROW_LIMIT);

  if (sibErr || !siblings?.length) return [];

  const counts = new Map<string, number>();
  for (const row of siblings) {
    const other = row.product_id as string;
    if (!other || other === productId) continue;
    counts.set(other, (counts.get(other) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      productId: id,
      reason: `Bought together in ${count} order${count === 1 ? "" : "s"}`,
    }));
});

/**
 * The ranked chain. Always returns published products only — the tier
 * queries filter on status, so a draft can never surface even if it has
 * affinity data from when it was published.
 */
export async function recommendProductIds(
  product: Product,
  limit = 4
): Promise<AiRecommendation[]> {
  const results: Scored[] = [];
  const seen = new Set<string>([product.id]);

  const supabase = await createClient();

  /** Keeps affinity results honest: drop anything not currently published. */
  async function publishedOnly(candidates: Scored[]): Promise<Scored[]> {
    if (candidates.length === 0) return [];
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("status", "published")
      .in("id", candidates.map((c) => c.productId).slice(0, 200));
    const live = new Set((data ?? []).map((r) => r.id as string));
    return candidates.filter((c) => live.has(c.productId));
  }

  try {
    // Tier 1-2: behavioural.
    const [coView, coPurchase] = await Promise.all([
      getCoViewAffinity(product.id),
      getCoPurchaseAffinity(product.id),
    ]);
    addUnique(results, await publishedOnly(coPurchase), seen, limit);
    addUnique(results, await publishedOnly(coView), seen, limit);
  } catch (error) {
    // Behavioural tiers are an enhancement; never let them break the page.
    logger.warn("recommendation affinity failed, using catalog tiers", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  // Tier 3: same category, nearest price.
  if (results.length < limit && product.category_id) {
    const low = product.base_price * (1 - PRICE_BAND);
    const high = product.base_price * (1 + PRICE_BAND);
    const { data } = await supabase
      .from("products")
      .select("id, base_price")
      .eq("status", "published")
      .eq("category_id", product.category_id)
      .neq("id", product.id)
      .gte("base_price", low)
      .lte("base_price", high)
      .limit(limit * 3);

    const ranked = (data ?? [])
      .map((row) => ({
        productId: row.id as string,
        distance: Math.abs(Number(row.base_price) - product.base_price),
      }))
      .sort((a, b) => a.distance - b.distance)
      .map((row) => ({ productId: row.productId, reason: "Similar style and price" }));

    addUnique(results, ranked, seen, limit);
  }

  // Tier 4: shares a collection.
  if (results.length < limit) {
    const { data: memberships } = await supabase
      .from("product_collections")
      .select("collection_id")
      .eq("product_id", product.id);

    const collectionIds = (memberships ?? []).map((r) => r.collection_id as string);
    if (collectionIds.length > 0) {
      const { data } = await supabase
        .from("product_collections")
        .select("product_id, products!inner(id, status)")
        .in("collection_id", collectionIds)
        .eq("products.status", "published")
        .limit(limit * 3);

      addUnique(
        results,
        (data ?? []).map((row) => ({
          productId: row.product_id as string,
          reason: "From the same collection",
        })),
        seen,
        limit
      );
    }
  }

  // Tier 5: featured, then newest — guarantees a non-empty result on a
  // brand-new site with no traffic, no orders and no collections.
  if (results.length < limit) {
    const { data } = await supabase
      .from("products")
      .select("id, is_featured")
      .eq("status", "published")
      .neq("id", product.id)
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit * 3);

    addUnique(
      results,
      (data ?? []).map((row) => ({
        productId: row.id as string,
        reason: row.is_featured ? "Featured piece" : "Recently added",
      })),
      seen,
      limit
    );
  }

  return results.slice(0, limit).map((r) => ({ productId: r.productId, reason: r.reason }));
}

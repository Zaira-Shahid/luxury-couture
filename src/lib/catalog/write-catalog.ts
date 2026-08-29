import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { logger } from "@/lib/logger";
import type { collectionSchema, productSchema } from "@/lib/validations/catalog";
import type { ProductStatus } from "@/types/database";

/**
 * Catalogue WRITE services — Module 38.
 *
 * EXTRACTED FROM THE SERVER ACTIONS, not written fresh, for the same
 * reason Module 37 extracted the admin readers: a Server Action is a
 * doorway, not a home for business logic, and MCP is now a second
 * doorway onto the same logic (Master Build Plan 12B.11).
 *
 * Three concrete problems made the extraction necessary rather than
 * merely tidy:
 *
 *  1. `createProduct` and `createCollection` ended in `redirect()`, which
 *     THROWS. Called from the MCP route there is no Next page render to
 *     catch it, so the dispatcher mapped the throw to INTERNAL_ERROR and
 *     told the caller "No changes were made." — after the row had been
 *     inserted. Reporting a successful write as a failure is the inverse
 *     of 12B.8, and an admin who believes it will create the record
 *     twice. `redirect()` now lives in the action wrapper, where a
 *     browser is there to receive it.
 *  2. The actions built their own client from request COOKIES. An MCP
 *     call over the Bearer transport carries no cookie, so every write
 *     would have run anonymously and been refused by RLS. The client is
 *     now a parameter.
 *  3. `ActionResult` is `{ error } | undefined` — success carries no id,
 *     because the action put it in the redirect URL. An audit row needs
 *     the id, and two of the four creates redirect to LIST pages where
 *     there is no id to recover. These services return it.
 *
 * Every function here takes an explicit client and RETURNS its outcome.
 * Nothing in this file throws, redirects, or revalidates — those are the
 * caller's concerns, and they differ per caller.
 */

export type WriteResult<T = { id: string }> = { ok: true; data: T } | { ok: false; error: string };

type ProductInput = z.infer<typeof productSchema>;
type CollectionInput = z.infer<typeof collectionSchema>;

/**
 * What a WRITE takes, which is not quite what the admin FORM produces.
 *
 * The form always posts the whole image list and the whole collection
 * membership, so `images: []` from a form honestly means "no images".
 * A tool call is the opposite: an assistant asked to fix a typo in a
 * description sends the description and nothing else, and `[]` there
 * would mean "delete every photograph on this product" — a destructive
 * act nobody asked for, performed by a medium-risk tool with no
 * confirmation.
 *
 * So the collection-shaped fields become OPTIONAL here, and `undefined`
 * means LEAVE UNCHANGED. The actions still pass the full list every
 * time, so nothing about the admin UI changes.
 */
type ProductWriteInput = Omit<ProductInput, "images"> & {
  images?: ProductInput["images"];
};
type CollectionWriteInput = Omit<CollectionInput, "productIds"> & {
  productIds?: CollectionInput["productIds"];
};

function duplicateSlugMessage(error: { message?: string } | null, fallback: string): string {
  return error?.message?.includes("duplicate") ? "That slug is already in use." : fallback;
}

/**
 * SEO metadata rides along with the product/collection it describes
 * rather than being a separate call site's responsibility — it was
 * already written that way in the action and moving it would change
 * behaviour.
 *
 * The upsert replaces BOTH columns, which is right for a form that
 * always posts both and wrong for a tool that sends one. So when only
 * one half arrives the existing row is read and the other half carried
 * over, instead of being nulled by omission.
 */
async function upsertSeoMetadata(
  client: SupabaseClient,
  entityType: "product" | "collection",
  entityId: string,
  metaTitle: string | null,
  metaDescription: string | null
) {
  if (!metaTitle && !metaDescription) return;

  const { data: existing } = await client
    .from("seo_metadata")
    .select("meta_title, meta_description")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  await client.from("seo_metadata").upsert(
    {
      entity_type: entityType,
      entity_id: entityId,
      meta_title: metaTitle ?? existing?.meta_title ?? null,
      meta_description: metaDescription ?? existing?.meta_description ?? null,
    },
    { onConflict: "entity_type,entity_id" }
  );
}

async function replaceProductImages(
  client: SupabaseClient,
  productId: string,
  images: ProductInput["images"] | undefined
) {
  // Not given at all: the caller is not talking about images. Returning
  // BEFORE the delete is the whole point — see ProductWriteInput.
  if (!images) return;

  // Replace wholesale — the existing behaviour for a small, admin-managed,
  // URL-paste list. Preserved exactly; this is not the module to change it.
  await client.from("product_images").delete().eq("product_id", productId);
  if (!images.length) return;
  await client.from("product_images").insert(
    images.map((img, i) => ({
      product_id: productId,
      url: img.url,
      alt_text: img.altText || null,
      sort_order: i,
      is_primary: img.isPrimary,
    }))
  );
}

export async function createProductRecord(
  input: ProductWriteInput,
  client: SupabaseClient
): Promise<WriteResult> {
  const { data: product, error } = await client
    .from("products")
    .insert({
      name: input.name,
      slug: input.slug,
      sku: input.sku,
      description: input.description,
      base_price: input.basePrice,
      currency: input.currency,
      category_id: input.categoryId,
      status: input.status,
      is_featured: input.isFeatured,
      published_at: input.status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !product) {
    logger.error("product create failed", error);
    return { ok: false, error: duplicateSlugMessage(error, "Could not create the product.") };
  }

  await replaceProductImages(client, product.id, input.images);
  await upsertSeoMetadata(client, "product", product.id, input.metaTitle, input.metaDescription);

  return { ok: true, data: { id: product.id } };
}

export async function updateProductRecord(
  productId: string,
  input: ProductWriteInput,
  client: SupabaseClient
): Promise<WriteResult> {
  const { data: existing } = await client
    .from("products")
    .select("status, published_at")
    .eq("id", productId)
    .single();

  // First publish stamps published_at; a re-publish keeps the original
  // date. Unchanged from the action — the storefront sorts on it.
  const publishedAt =
    input.status === "published" ? (existing?.published_at ?? new Date().toISOString()) : null;

  const { error } = await client
    .from("products")
    .update({
      name: input.name,
      slug: input.slug,
      sku: input.sku,
      description: input.description,
      base_price: input.basePrice,
      currency: input.currency,
      category_id: input.categoryId,
      status: input.status,
      is_featured: input.isFeatured,
      published_at: publishedAt,
    })
    .eq("id", productId);

  if (error) {
    logger.error("product update failed", error, { productId });
    return { ok: false, error: "Could not update the product." };
  }

  await replaceProductImages(client, productId, input.images);
  await upsertSeoMetadata(client, "product", productId, input.metaTitle, input.metaDescription);

  return { ok: true, data: { id: productId } };
}

/**
 * A status-only transition, for the tools that publish and archive.
 *
 * Separate from `updateProductRecord` on purpose. 12B.6 makes publishing
 * and archiving high-risk while an ordinary field edit is not, and `risk`
 * is declared per TOOL rather than per input — so the two cannot share
 * one entry point without either over-gating every typo fix or
 * under-gating a publish.
 *
 * Returns the previous status so the caller can record a truthful `before`
 * in the audit row.
 */
export async function setProductStatus(
  productId: string,
  status: ProductStatus,
  client: SupabaseClient
): Promise<WriteResult<{ id: string; previousStatus: ProductStatus }>> {
  const { data: existing, error: readError } = await client
    .from("products")
    .select("status, published_at")
    .eq("id", productId)
    .maybeSingle();

  if (readError) {
    logger.error("product status read failed", readError, { productId });
    return { ok: false, error: "Could not read the product." };
  }
  if (!existing) return { ok: false, error: "That product could not be found." };

  const { error } = await client
    .from("products")
    .update({
      status,
      published_at: status === "published" ? (existing.published_at ?? new Date().toISOString()) : null,
    })
    .eq("id", productId);

  if (error) {
    logger.error("product status update failed", error, { productId, status });
    return { ok: false, error: "Could not update the product." };
  }

  return { ok: true, data: { id: productId, previousStatus: existing.status as ProductStatus } };
}

async function syncCollectionProducts(
  client: SupabaseClient,
  collectionId: string,
  productIds: string[] | undefined
) {
  if (!productIds) return;

  await client.from("product_collections").delete().eq("collection_id", collectionId);
  if (!productIds.length) return;
  await client
    .from("product_collections")
    .insert(productIds.map((productId) => ({ collection_id: collectionId, product_id: productId })));
}

export async function createCollectionRecord(
  input: CollectionWriteInput,
  client: SupabaseClient
): Promise<WriteResult> {
  const { data: collection, error } = await client
    .from("collections")
    .insert({
      name: input.name,
      slug: input.slug,
      description: input.description,
      cover_image_url: input.coverImageUrl,
      is_featured: input.isFeatured,
      is_active: input.isActive,
      published_at: input.isActive ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !collection) {
    logger.error("collection create failed", error);
    return { ok: false, error: duplicateSlugMessage(error, "Could not create the collection.") };
  }

  await syncCollectionProducts(client, collection.id, input.productIds);
  await upsertSeoMetadata(client, "collection", collection.id, input.metaTitle, input.metaDescription);

  return { ok: true, data: { id: collection.id } };
}

export async function updateCollectionRecord(
  collectionId: string,
  input: CollectionWriteInput,
  client: SupabaseClient
): Promise<WriteResult> {
  const { error } = await client
    .from("collections")
    .update({
      name: input.name,
      slug: input.slug,
      description: input.description,
      cover_image_url: input.coverImageUrl,
      is_featured: input.isFeatured,
      is_active: input.isActive,
    })
    .eq("id", collectionId);

  if (error) {
    logger.error("collection update failed", error, { collectionId });
    return { ok: false, error: "Could not update the collection." };
  }

  await syncCollectionProducts(client, collectionId, input.productIds);
  await upsertSeoMetadata(client, "collection", collectionId, input.metaTitle, input.metaDescription);

  return { ok: true, data: { id: collectionId } };
}

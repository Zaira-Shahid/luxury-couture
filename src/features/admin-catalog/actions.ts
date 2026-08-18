"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { categorySchema, collectionSchema, productSchema } from "@/lib/validations/catalog";

export type ActionResult = { error: string } | undefined;

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

function parseImagesField(formData: FormData) {
  const raw = formData.get("images");
  if (typeof raw !== "string" || !raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function upsertSeoMetadata(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entityType: "product" | "collection",
  entityId: string,
  metaTitle: string | null,
  metaDescription: string | null
) {
  if (!metaTitle && !metaDescription) return;
  await supabase
    .from("seo_metadata")
    .upsert(
      { entity_type: entityType, entity_id: entityId, meta_title: metaTitle, meta_description: metaDescription },
      { onConflict: "entity_type,entity_id" }
    );
}

// ---- Products --------------------------------------------------------

export async function createProduct(formData: FormData): Promise<ActionResult> {
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    sku: formData.get("sku"),
    description: formData.get("description"),
    basePrice: formData.get("basePrice"),
    currency: formData.get("currency") || "GBP",
    categoryId: formData.get("categoryId"),
    status: formData.get("status"),
    isFeatured: formData.get("isFeatured") === "on",
    metaTitle: formData.get("metaTitle"),
    metaDescription: formData.get("metaDescription"),
    images: parseImagesField(formData),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      sku: parsed.data.sku,
      description: parsed.data.description,
      base_price: parsed.data.basePrice,
      currency: parsed.data.currency,
      category_id: parsed.data.categoryId,
      status: parsed.data.status,
      is_featured: parsed.data.isFeatured,
      published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error || !product) {
    logger.error("product create failed", error);
    return { error: error?.message.includes("duplicate") ? "That slug is already in use." : "Could not create the product." };
  }

  if (parsed.data.images.length) {
    await supabase.from("product_images").insert(
      parsed.data.images.map((img, i) => ({
        product_id: product.id,
        url: img.url,
        alt_text: img.altText || null,
        sort_order: i,
        is_primary: img.isPrimary,
      }))
    );
  }

  await upsertSeoMetadata(supabase, "product", product.id, parsed.data.metaTitle, parsed.data.metaDescription);

  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect(`/admin/products/${product.id}/edit`);
}

export async function updateProduct(productId: string, formData: FormData): Promise<ActionResult> {
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    sku: formData.get("sku"),
    description: formData.get("description"),
    basePrice: formData.get("basePrice"),
    currency: formData.get("currency") || "GBP",
    categoryId: formData.get("categoryId"),
    status: formData.get("status"),
    isFeatured: formData.get("isFeatured") === "on",
    metaTitle: formData.get("metaTitle"),
    metaDescription: formData.get("metaDescription"),
    images: parseImagesField(formData),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("products")
    .select("status, published_at")
    .eq("id", productId)
    .single();

  const publishedAt =
    parsed.data.status === "published"
      ? (existing?.published_at ?? new Date().toISOString())
      : null;

  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      sku: parsed.data.sku,
      description: parsed.data.description,
      base_price: parsed.data.basePrice,
      currency: parsed.data.currency,
      category_id: parsed.data.categoryId,
      status: parsed.data.status,
      is_featured: parsed.data.isFeatured,
      published_at: publishedAt,
    })
    .eq("id", productId);

  if (error) {
    logger.error("product update failed", error, { productId });
    return { error: "Could not update the product." };
  }

  // Replace the image list wholesale — simplest correct approach for a
  // small, admin-managed, URL-paste list (no upload, no ordering drag-drop).
  await supabase.from("product_images").delete().eq("product_id", productId);
  if (parsed.data.images.length) {
    await supabase.from("product_images").insert(
      parsed.data.images.map((img, i) => ({
        product_id: productId,
        url: img.url,
        alt_text: img.altText || null,
        sort_order: i,
        is_primary: img.isPrimary,
      }))
    );
  }

  await upsertSeoMetadata(supabase, "product", productId, parsed.data.metaTitle, parsed.data.metaDescription);

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath("/products");
  revalidatePath(`/products/${parsed.data.slug}`);
  return undefined;
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) {
    logger.error("product delete failed", error, { productId });
    return { error: "Could not delete the product." };
  }
  revalidatePath("/admin/products");
  revalidatePath("/products");
  return undefined;
}

// ---- Collections -------------------------------------------------------

async function syncCollectionProducts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  collectionId: string,
  productIds: string[]
) {
  await supabase.from("product_collections").delete().eq("collection_id", collectionId);
  if (productIds.length) {
    await supabase
      .from("product_collections")
      .insert(productIds.map((productId) => ({ collection_id: collectionId, product_id: productId })));
  }
}

export async function createCollection(formData: FormData): Promise<ActionResult> {
  const parsed = collectionSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    coverImageUrl: formData.get("coverImageUrl"),
    isFeatured: formData.get("isFeatured") === "on",
    isActive: formData.get("isActive") === "on",
    metaTitle: formData.get("metaTitle"),
    metaDescription: formData.get("metaDescription"),
    productIds: formData.getAll("productIds") as string[],
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { data: collection, error } = await supabase
    .from("collections")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      cover_image_url: parsed.data.coverImageUrl,
      is_featured: parsed.data.isFeatured,
      is_active: parsed.data.isActive,
      published_at: parsed.data.isActive ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error || !collection) {
    logger.error("collection create failed", error);
    return { error: error?.message.includes("duplicate") ? "That slug is already in use." : "Could not create the collection." };
  }

  await syncCollectionProducts(supabase, collection.id, parsed.data.productIds);
  await upsertSeoMetadata(supabase, "collection", collection.id, parsed.data.metaTitle, parsed.data.metaDescription);

  revalidatePath("/admin/collections");
  revalidatePath("/collections");
  redirect(`/admin/collections/${collection.id}/edit`);
}

export async function updateCollection(collectionId: string, formData: FormData): Promise<ActionResult> {
  const parsed = collectionSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    coverImageUrl: formData.get("coverImageUrl"),
    isFeatured: formData.get("isFeatured") === "on",
    isActive: formData.get("isActive") === "on",
    metaTitle: formData.get("metaTitle"),
    metaDescription: formData.get("metaDescription"),
    productIds: formData.getAll("productIds") as string[],
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("collections")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      cover_image_url: parsed.data.coverImageUrl,
      is_featured: parsed.data.isFeatured,
      is_active: parsed.data.isActive,
    })
    .eq("id", collectionId);

  if (error) {
    logger.error("collection update failed", error, { collectionId });
    return { error: "Could not update the collection." };
  }

  await syncCollectionProducts(supabase, collectionId, parsed.data.productIds);
  await upsertSeoMetadata(supabase, "collection", collectionId, parsed.data.metaTitle, parsed.data.metaDescription);

  revalidatePath("/admin/collections");
  revalidatePath(`/admin/collections/${collectionId}/edit`);
  revalidatePath("/collections");
  revalidatePath(`/collections/${parsed.data.slug}`);
  return undefined;
}

export async function deleteCollection(collectionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("collections").delete().eq("id", collectionId);
  if (error) {
    logger.error("collection delete failed", error, { collectionId });
    return { error: "Could not delete the collection." };
  }
  revalidatePath("/admin/collections");
  revalidatePath("/collections");
  return undefined;
}

// ---- Categories ----------------------------------------------------------

export async function createCategory(formData: FormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    imageUrl: formData.get("imageUrl"),
    isActive: formData.get("isActive") === "on",
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description,
    image_url: parsed.data.imageUrl,
    is_active: parsed.data.isActive,
    sort_order: parsed.data.sortOrder,
  });

  if (error) {
    logger.error("category create failed", error);
    return { error: error.message.includes("duplicate") ? "That slug is already in use." : "Could not create the category." };
  }

  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function updateCategory(categoryId: string, formData: FormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    imageUrl: formData.get("imageUrl"),
    isActive: formData.get("isActive") === "on",
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      image_url: parsed.data.imageUrl,
      is_active: parsed.data.isActive,
      sort_order: parsed.data.sortOrder,
    })
    .eq("id", categoryId);

  if (error) {
    logger.error("category update failed", error, { categoryId });
    return { error: "Could not update the category." };
  }

  revalidatePath("/admin/categories");
  return undefined;
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) {
    logger.error("category delete failed", error, { categoryId });
    return { error: "Could not delete the category." };
  }
  revalidatePath("/admin/categories");
  return undefined;
}

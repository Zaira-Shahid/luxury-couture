"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  createCollectionRecord,
  createProductRecord,
  updateCollectionRecord,
  updateProductRecord,
} from "@/lib/catalog/write-catalog";
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

  const result = await createProductRecord(parsed.data, await createClient());
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/products");
  revalidatePath("/products");
  // redirect() THROWS, which is why it lives here and not in the service:
  // a browser has a Next render to catch it, and the MCP route does not.
  redirect(`/admin/products/${result.data.id}/edit`);
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

  const result = await updateProductRecord(productId, parsed.data, await createClient());
  if (!result.ok) return { error: result.error };

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

  const result = await createCollectionRecord(parsed.data, await createClient());
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/collections");
  revalidatePath("/collections");
  redirect(`/admin/collections/${result.data.id}/edit`);
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

  const result = await updateCollectionRecord(collectionId, parsed.data, await createClient());
  if (!result.ok) return { error: result.error };

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

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { inventoryItemSchema } from "@/lib/validations/inventory";

export type ActionResult = { error: string } | undefined;

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

function parseFormData(formData: FormData) {
  return inventoryItemSchema.safeParse({
    category: formData.get("category"),
    fabricId: formData.get("fabricId") ?? "",
    name: formData.get("name"),
    sku: formData.get("sku") ?? "",
    unit: formData.get("unit"),
    stockQuantity: formData.get("stockQuantity") || 0,
    reservedQuantity: formData.get("reservedQuantity") || 0,
    lowStockThreshold: formData.get("lowStockThreshold") || 0,
    isAvailable: formData.get("isAvailable") === "on",
    notes: formData.get("notes") ?? "",
  });
}

export async function createInventoryItem(formData: FormData): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert({
    category: parsed.data.category,
    fabric_id: parsed.data.category === "fabric" && parsed.data.fabricId ? parsed.data.fabricId : null,
    name: parsed.data.name,
    sku: parsed.data.sku || null,
    unit: parsed.data.unit,
    stock_quantity: parsed.data.stockQuantity,
    reserved_quantity: parsed.data.reservedQuantity,
    low_stock_threshold: parsed.data.lowStockThreshold,
    is_available: parsed.data.isAvailable,
    notes: parsed.data.notes || null,
  });
  if (error) {
    logger.error("inventory item creation failed", error);
    return { error: "Could not create this inventory item. Please try again." };
  }

  revalidatePath("/admin/inventory");
  redirect("/admin/inventory");
}

export async function updateInventoryItem(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_items")
    .update({
      category: parsed.data.category,
      fabric_id: parsed.data.category === "fabric" && parsed.data.fabricId ? parsed.data.fabricId : null,
      name: parsed.data.name,
      sku: parsed.data.sku || null,
      unit: parsed.data.unit,
      stock_quantity: parsed.data.stockQuantity,
      reserved_quantity: parsed.data.reservedQuantity,
      low_stock_threshold: parsed.data.lowStockThreshold,
      is_available: parsed.data.isAvailable,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);
  if (error) {
    logger.error("inventory item update failed", error, { id });
    return { error: "Could not update this inventory item. Please try again." };
  }

  revalidatePath("/admin/inventory");
  return undefined;
}

export async function deleteInventoryItem(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) {
    logger.error("inventory item delete failed", error, { id });
    return { error: "Could not delete this inventory item. Please try again." };
  }

  revalidatePath("/admin/inventory");
  return undefined;
}

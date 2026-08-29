"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  createBuilderOptionRecord,
  updateBuilderOptionRecord,
} from "@/lib/builder/write-options";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { builderOptionSchema, builderOptionTableSchema } from "@/lib/validations/builder-options";
import type { BuilderOptionTable } from "@/types/database";

export type ActionResult = { error: string } | undefined;

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

function parseFormData(formData: FormData) {
  return builderOptionSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    hexValue: formData.get("hexValue") ?? "",
    imageUrl: formData.get("imageUrl") ?? "",
    priceAdjustment: formData.get("priceAdjustment") || 0,
    isActive: formData.get("isActive") === "on",
    sortOrder: formData.get("sortOrder") || 0,
  });
}

/**
 * table is validated against the literal 6-value whitelist (never
 * interpolated from user input unchecked) before it ever reaches .from() —
 * all six tables share identical RLS (is_admin()-gated insert/update/
 * delete, 0003), so one generic action set covers all of them.
 */
export async function createBuilderOption(tableInput: string, formData: FormData): Promise<ActionResult> {
  const tableResult = builderOptionTableSchema.safeParse(tableInput);
  if (!tableResult.success) return { error: "Invalid option type." };
  const table: BuilderOptionTable = tableResult.data;

  const parsed = parseFormData(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await createBuilderOptionRecord(table, parsed.data, await createClient());
  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/builder/${table}`);
  // redirect() throws — it belongs in the wrapper, where a browser is
  // there to receive it, not in the service MCP also calls.
  redirect(`/admin/builder/${table}`);
}

export async function updateBuilderOption(
  tableInput: string,
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const tableResult = builderOptionTableSchema.safeParse(tableInput);
  if (!tableResult.success) return { error: "Invalid option type." };
  const table: BuilderOptionTable = tableResult.data;

  const parsed = parseFormData(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await updateBuilderOptionRecord(table, id, parsed.data, await createClient());
  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/builder/${table}`);
  return undefined;
}

export async function deleteBuilderOption(tableInput: string, id: string): Promise<ActionResult> {
  const tableResult = builderOptionTableSchema.safeParse(tableInput);
  if (!tableResult.success) return { error: "Invalid option type." };
  const table: BuilderOptionTable = tableResult.data;

  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    logger.error("builder option delete failed", error, { table, id });
    return { error: "Could not delete this option. Please try again." };
  }

  revalidatePath(`/admin/builder/${table}`);
  return undefined;
}

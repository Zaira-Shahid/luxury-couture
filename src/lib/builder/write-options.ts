import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { logger } from "@/lib/logger";
import type { builderOptionSchema } from "@/lib/validations/builder-options";
import type { BuilderOptionTable } from "@/types/database";

import type { WriteResult } from "@/lib/catalog/write-catalog";

/**
 * Builder-option WRITE services — Module 38.
 *
 * Extracted from `features/admin-builder-options/actions.ts` for the
 * reasons set out at the top of `lib/catalog/write-catalog.ts`:
 * `createBuilderOption` ended in a `redirect()` that throws, the actions
 * built their own cookie-bound client, and success carried no id.
 *
 * `createBuilderOption` was the worst of the four creates for MCP: it
 * redirected to the option LIST page, so even parsing the redirect
 * destination could not have recovered the new row's id for the audit
 * row. Selecting it back is the only way, and a service can.
 *
 * `table` stays a typed `BuilderOptionTable` here, exactly as the action
 * had it. The tools never expose it — 12B.15 forbids a tool taking a
 * table name, so `tools/catalog.ts` maps a closed enum of business names
 * (fabric, embroidery, colour, …) onto these values.
 */

type OptionInput = z.infer<typeof builderOptionSchema>;

/** Colour carries `hex_value` where the other five carry `description`. */
function rowFor(table: BuilderOptionTable, input: OptionInput): Record<string, unknown> {
  const row: Record<string, unknown> = {
    name: input.name,
    slug: input.slug,
    image_url: input.imageUrl || null,
    price_adjustment: input.priceAdjustment,
    is_active: input.isActive,
    sort_order: input.sortOrder,
  };
  if (table === "colours") row.hex_value = input.hexValue || null;
  else row.description = input.description || null;
  return row;
}

export async function createBuilderOptionRecord(
  table: BuilderOptionTable,
  input: OptionInput,
  client: SupabaseClient
): Promise<WriteResult> {
  const { data, error } = await client
    .from(table)
    .insert(rowFor(table, input))
    .select("id")
    .single();

  if (error || !data) {
    logger.error("builder option creation failed", error, { table });
    return { ok: false, error: "Could not create this option. Please try again." };
  }
  return { ok: true, data: { id: data.id } };
}

export async function updateBuilderOptionRecord(
  table: BuilderOptionTable,
  id: string,
  input: OptionInput,
  client: SupabaseClient
): Promise<WriteResult> {
  const { error } = await client.from(table).update(rowFor(table, input)).eq("id", id);

  if (error) {
    logger.error("builder option update failed", error, { table, id });
    return { ok: false, error: "Could not update this option. Please try again." };
  }
  return { ok: true, data: { id } };
}

/**
 * Deactivation — the reversible stand-in for deletion.
 *
 * No MCP tool deletes a builder option. A deleted option is referenced by
 * every saved builder configuration that chose it, and 12B.6 treats
 * removing something customers can pick as high-risk; `is_active = false`
 * takes it out of the builder while leaving the history intact.
 *
 * Returns the previous flag so the audit row's `before` is truthful, and
 * reports NOT-FOUND distinctly rather than silently succeeding on an id
 * that matches nothing.
 */
export async function setBuilderOptionActive(
  table: BuilderOptionTable,
  id: string,
  isActive: boolean,
  client: SupabaseClient
): Promise<WriteResult<{ id: string; previouslyActive: boolean; name: string }>> {
  const { data: existing, error: readError } = await client
    .from(table)
    .select("id, name, is_active")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    logger.error("builder option read failed", readError, { table, id });
    return { ok: false, error: "Could not read this option." };
  }
  if (!existing) return { ok: false, error: "That builder option could not be found." };

  const { error } = await client.from(table).update({ is_active: isActive }).eq("id", id);
  if (error) {
    logger.error("builder option activation failed", error, { table, id, isActive });
    return { ok: false, error: "Could not update this option. Please try again." };
  }

  return {
    ok: true,
    data: { id, previouslyActive: existing.is_active as boolean, name: existing.name as string },
  };
}

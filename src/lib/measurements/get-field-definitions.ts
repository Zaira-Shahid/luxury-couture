import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { MeasurementFieldDefinition } from "@/types/database";

export const getMeasurementFieldDefinitions = cache(
  async (): Promise<MeasurementFieldDefinition[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("measurement_field_definitions")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      logger.warn("failed to load measurement field definitions", { message: error.message });
      return [];
    }
    return (data ?? []) as MeasurementFieldDefinition[];
  }
);

export function groupFieldsByCategory(fields: MeasurementFieldDefinition[]) {
  const groups = new Map<string, MeasurementFieldDefinition[]>();
  for (const field of fields) {
    const list = groups.get(field.category) ?? [];
    list.push(field);
    groups.set(field.category, list);
  }
  return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
}

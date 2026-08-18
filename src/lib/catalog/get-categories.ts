import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Category } from "@/types/database";

export const getActiveCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    logger.warn("failed to load categories", { message: error.message });
    return [];
  }
  return (data ?? []) as Category[];
});

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { ConsultationType } from "@/types/database";

export const getConsultationTypes = cache(async (): Promise<ConsultationType[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consultation_types")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    logger.warn("failed to load consultation types", { message: error.message });
    return [];
  }
  return (data ?? []) as ConsultationType[];
});

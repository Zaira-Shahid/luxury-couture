import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  Colour,
  DupattaOption,
  EmbroideryType,
  Fabric,
  Neckline,
  SleeveStyle,
} from "@/types/database";

export type BuilderOptionSets = {
  fabrics: Fabric[];
  embroidery: EmbroideryType[];
  colours: Colour[];
  sleeveStyles: SleeveStyle[];
  necklines: Neckline[];
  dupattaOptions: DupattaOption[];
};

/** Every active builder option, full fields — used by the step UI, not the homepage teaser. */
export const getBuilderOptionSets = cache(async (): Promise<BuilderOptionSets> => {
  const supabase = await createClient();
  const [fabrics, embroidery, colours, sleeveStyles, necklines, dupattaOptions] = await Promise.all([
    supabase.from("fabrics").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("embroidery_types").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("colours").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("sleeve_styles").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("necklines").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("dupatta_options").select("*").eq("is_active", true).order("sort_order"),
  ]);

  for (const [label, result] of [
    ["fabrics", fabrics],
    ["embroidery", embroidery],
    ["colours", colours],
    ["sleeveStyles", sleeveStyles],
    ["necklines", necklines],
    ["dupattaOptions", dupattaOptions],
  ] as const) {
    if (result.error) logger.warn(`failed to load builder option: ${label}`, { message: result.error.message });
  }

  return {
    fabrics: (fabrics.data ?? []) as Fabric[],
    embroidery: (embroidery.data ?? []) as EmbroideryType[],
    colours: (colours.data ?? []) as Colour[],
    sleeveStyles: (sleeveStyles.data ?? []) as SleeveStyle[],
    necklines: (necklines.data ?? []) as Neckline[],
    dupattaOptions: (dupattaOptions.data ?? []) as DupattaOption[],
  };
});

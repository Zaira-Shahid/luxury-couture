import { z } from "zod";

import { BUILDER_OPTION_TABLES } from "@/types/database";

export const builderOptionTableSchema = z.enum(BUILDER_OPTION_TABLES);

const baseFields = {
  name: z.string().trim().min(1, "Name is required.").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only."),
  imageUrl: z.string().trim().max(2000).optional().or(z.literal("")),
  priceAdjustment: z.coerce.number(),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int(),
};

// Every table but colours uses "description"; colours uses "hexValue" in
// its place — both optional so one schema (with fields simply unused for
// the other shape) can serve every table's form.
export const builderOptionSchema = z.object({
  ...baseFields,
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  hexValue: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #A1B2C3.")
    .optional()
    .or(z.literal("")),
});

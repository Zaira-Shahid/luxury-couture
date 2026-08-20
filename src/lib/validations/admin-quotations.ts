import { z } from "zod";

export const createQuotationSchema = z.object({
  quotedPrice: z.coerce.number().min(0, "Enter a valid price."),
  depositPercentage: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? Number(value) : null)),
  validUntil: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
});

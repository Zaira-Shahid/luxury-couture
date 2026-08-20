import { z } from "zod";

const optionalId = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : null));

export const builderSelectionsSchema = z.object({
  productId: optionalId,
  fabricId: optionalId,
  embroideryTypeId: optionalId,
  colourId: optionalId,
  sleeveStyleId: optionalId,
  necklineId: optionalId,
  dupattaOptionId: optionalId,
  customNotes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
});

export const requestQuotationSchema = z.object({
  contactName: z.string().trim().min(2, "Enter your name.").max(200),
  contactEmail: z.string().trim().email("Enter a valid email address."),
  contactPhone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
});

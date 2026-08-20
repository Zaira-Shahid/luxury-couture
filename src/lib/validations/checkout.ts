import { z } from "zod";

export const placeOrderSchema = z.object({
  addressId: z.string().trim().min(1, "Choose a shipping address."),
  measurementProfileId: z
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

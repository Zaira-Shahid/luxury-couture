import { z } from "zod";

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(200),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
});

export const addressSchema = z.object({
  label: z
    .string()
    .trim()
    .max(50)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  recipientName: z.string().trim().min(2, "Enter a recipient name.").max(200),
  line1: z.string().trim().min(1, "Enter the street address.").max(300),
  line2: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  city: z.string().trim().min(1, "Enter a city.").max(100),
  region: z
    .string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  postalCode: z.string().trim().min(1, "Enter a postal code.").max(20),
  country: z.string().trim().min(1, "Enter a country.").max(100),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  isDefault: z.boolean().optional().default(false),
});

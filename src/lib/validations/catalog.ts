import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null));

export const productImageInputSchema = z.object({
  url: z.string().trim().url("Enter a valid image URL."),
  altText: z.string().trim().max(200).optional().or(z.literal("")),
  isPrimary: z.boolean().optional().default(false),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Enter a product name.").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Enter a slug.")
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only."),
  sku: optionalText(100),
  description: optionalText(5000),
  basePrice: z.coerce.number().min(0, "Price must be 0 or more."),
  currency: z.string().trim().length(3, "Use a 3-letter currency code.").default("GBP"),
  categoryId: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  status: z.enum(["draft", "published", "archived"]),
  isFeatured: z.boolean().optional().default(false),
  metaTitle: optionalText(200),
  metaDescription: optionalText(400),
  images: z.array(productImageInputSchema).max(20).default([]),
});

export const collectionSchema = z.object({
  name: z.string().trim().min(1, "Enter a collection name.").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Enter a slug.")
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only."),
  description: optionalText(5000),
  coverImageUrl: optionalText(2000),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  metaTitle: optionalText(200),
  metaDescription: optionalText(400),
  productIds: z.array(z.string()).default([]),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Enter a slug.")
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only."),
  description: optionalText(1000),
  imageUrl: optionalText(2000),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

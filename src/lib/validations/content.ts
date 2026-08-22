import { z } from "zod";

import { isReservedRootSlug } from "@/lib/routes/reserved-slugs";

/**
 * Slugs become public URLs (/about, /blog/my-post), so they're normalised
 * and constrained here rather than trusting whatever an admin types.
 * Lowercase alphanumerics and single hyphens only — no spaces, no
 * slashes, no leading/trailing hyphens.
 */
const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(120)
  .transform((v) => v.toLowerCase())
  .refine((v) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), {
    message: "Use lowercase letters, numbers and single hyphens (e.g. size-guide).",
  });

export const pageSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  // CMS pages live at the root, so a slug matching a real storefront route
  // would create a page the router can never reach (static routes always
  // win). Rejecting these turns a silently-invisible page into an
  // immediate, explicable error. The same list drives middleware's 404
  // check — see lib/routes/reserved-slugs.ts for why it's shared.
  slug: slugSchema.refine((v) => !isReservedRootSlug(v), {
    message: "That slug is reserved by an existing site route — choose another.",
  }),
  content: z.string().trim().max(50_000).optional().or(z.literal("")),
  status: z.enum(["draft", "published"]),
});

export const blogPostSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  slug: slugSchema,
  excerpt: z.string().trim().max(500).optional().or(z.literal("")),
  content: z.string().trim().max(50_000).optional().or(z.literal("")),
  coverImageUrl: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(["draft", "published"]),
});

export const faqSchema = z.object({
  question: z.string().trim().min(1, "Question is required.").max(300),
  answer: z.string().trim().min(1, "Answer is required.").max(5000),
  category: z.string().trim().max(100).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int(),
  isActive: z.boolean(),
});

export const occasionSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  slug: slugSchema,
  description: z.string().trim().max(500).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int(),
  isActive: z.boolean(),
});

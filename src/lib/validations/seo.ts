import { z } from "zod";

export const seoDefaultsSchema = z.object({
  defaultTitle: z.string().trim().max(200).optional().or(z.literal("")),
  defaultDescription: z.string().trim().max(500).optional().or(z.literal("")),
  defaultOgImageUrl: z.string().trim().max(2000).optional().or(z.literal("")),
  twitterHandle: z
    .string()
    .trim()
    .max(50)
    .optional()
    .or(z.literal(""))
    // Twitter/X card tags expect the leading "@"; add it rather than
    // rejecting an admin who typed the handle without one.
    .transform((v) => (v && !v.startsWith("@") ? `@${v}` : v)),
  googleSiteVerification: z.string().trim().max(200).optional().or(z.literal("")),
  indexingEnabled: z.boolean(),
});

export const seoOverrideSchema = z.object({
  entityType: z.enum(["product", "collection", "page", "blog_post"]),
  entityId: z.string().uuid("Select a valid item."),
  metaTitle: z.string().trim().max(200).optional().or(z.literal("")),
  metaDescription: z.string().trim().max(500).optional().or(z.literal("")),
  ogImageUrl: z.string().trim().max(2000).optional().or(z.literal("")),
  canonicalUrl: z.string().trim().max(2000).optional().or(z.literal("")),
});

import { z } from "zod";

export const newsletterSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required.")
    .max(50)
    .transform((v) => v.toUpperCase()),
  type: z.enum(["percentage", "fixed"]),
  value: z.coerce.number().positive("Enter a value greater than zero."),
  minOrderAmount: z.coerce.number().min(0).optional().or(z.literal("")),
  maxUses: z.coerce.number().int().positive().optional().or(z.literal("")),
  startsAt: z.string().trim().optional().or(z.literal("")),
  expiresAt: z.string().trim().optional().or(z.literal("")),
  isActive: z.boolean(),
});

export const applyCouponSchema = z.object({
  code: z.string().trim().min(1, "Enter a coupon code.").max(50),
});

export const redeemPointsSchema = z.object({
  points: z.coerce.number().int().positive("Enter a positive number of points."),
});

export const campaignSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required.").max(200),
  body: z.string().trim().min(1, "Body is required.").max(5000),
  target: z.enum(["all_subscribers", "vip_customers", "new_customers", "at_risk_customers"]),
});

export const bannerSchema = z.object({
  text: z.string().trim().min(1, "Text is required.").max(300),
  linkUrl: z.string().trim().max(2000).optional().or(z.literal("")),
  startsAt: z.string().trim().optional().or(z.literal("")),
  expiresAt: z.string().trim().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int(),
  isActive: z.boolean(),
});

export const referralCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .max(50)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.toUpperCase() : "")),
});

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

export const referralCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .max(50)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.toUpperCase() : "")),
});

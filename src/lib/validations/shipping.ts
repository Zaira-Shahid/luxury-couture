import { z } from "zod";

export const SHIPPING_STATUSES = [
  "pending",
  "label_created",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
] as const;

export const advanceShippingStatusSchema = z.object({
  status: z.enum(SHIPPING_STATUSES),
  note: z.string().trim().max(1000).optional(),
});

export const updateShippingDetailsSchema = z.object({
  courier: z.string().trim().max(200).optional(),
  trackingNumber: z.string().trim().max(200).optional(),
});

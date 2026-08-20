import { z } from "zod";

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "in_production",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(1000).optional(),
});

export const addOrderNoteSchema = z.object({
  note: z.string().trim().min(1, "Note cannot be empty.").max(2000),
});

export const sendCustomerMessageSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  body: z.string().trim().min(1, "Message is required.").max(2000),
});

export const sendToProductionSchema = z.object({
  estimatedCompletionDate: z.string().trim().optional(),
});

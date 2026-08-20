import { z } from "zod";

export const PRODUCTION_STATUSES = [
  "order_confirmed",
  "measurements_verified",
  "design_approved",
  "materials_prepared",
  "cutting",
  "embroidery",
  "stitching",
  "finishing",
  "quality_check",
  "ready_for_dispatch",
  "shipped",
  "delivered",
] as const;

export const advanceProductionStatusSchema = z.object({
  status: z.enum(PRODUCTION_STATUSES),
  note: z.string().trim().max(1000).optional(),
});

export const updateProductionDetailsSchema = z.object({
  assignedTeam: z.string().trim().max(200).optional(),
  estimatedCompletionDate: z.string().trim().optional(),
});

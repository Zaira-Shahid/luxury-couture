import { z } from "zod";

export const inventoryItemSchema = z.object({
  category: z.enum(["fabric", "material", "embroidery_material"]),
  fabricId: z.string().trim().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Name is required.").max(200),
  sku: z.string().trim().max(100).optional().or(z.literal("")),
  unit: z.string().trim().min(1, "Unit is required.").max(50),
  stockQuantity: z.coerce.number().min(0, "Must be zero or more."),
  reservedQuantity: z.coerce.number().min(0, "Must be zero or more."),
  lowStockThreshold: z.coerce.number().min(0, "Must be zero or more."),
  isAvailable: z.boolean(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

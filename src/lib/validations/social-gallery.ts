import { z } from "zod";

export const socialGalleryImageSchema = z.object({
  imageUrl: z.string().trim().min(1, "Image URL is required.").max(2000),
  caption: z.string().trim().max(200).optional().or(z.literal("")),
  linkUrl: z.string().trim().max(2000).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int(),
  isActive: z.boolean(),
});

import { z } from "zod";

export const submitReviewSchema = z.object({
  orderId: z.string().trim().min(1, "Order is required."),
  productId: z.string().trim().optional().or(z.literal("")),
  rating: z.coerce.number().int().min(1, "Choose a rating.").max(5),
  title: z.string().trim().max(200).optional().or(z.literal("")),
  body: z.string().trim().max(2000).optional().or(z.literal("")),
  reviewerName: z.string().trim().max(100).optional().or(z.literal("")),
});

export const addReviewVideoLinkSchema = z.object({
  url: z.string().trim().url("Enter a valid video URL.").max(2000),
});

import { z } from "zod";

export const productEnquirySchema = z.object({
  contactName: z.string().trim().min(2, "Enter your name.").max(200),
  contactEmail: z.string().trim().email("Enter a valid email address."),
  contactPhone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  message: z.string().trim().min(1, "Enter a message.").max(2000),
});

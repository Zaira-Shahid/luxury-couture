import { z } from "zod";

export const createAdditionalPaymentSchema = z.object({
  type: z.enum(["deposit", "balance", "full"]),
  amount: z.coerce.number().positive("Enter a valid amount."),
});

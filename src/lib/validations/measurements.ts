import { z } from "zod";

export const measurementProfileMetaSchema = z.object({
  label: z.string().trim().min(1, "Give this profile a name.").max(100),
  unit: z.enum(["cm", "inch"]),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
});

// Matches the DB check (value > 0); upper bound catches obvious entry
// mistakes (e.g. typing 5000 instead of 50) without being falsely strict —
// generous enough to cover inches (up to ~200) and cm (up to ~500).
export const measurementValueSchema = z.coerce
  .number()
  .positive("Must be a positive number.")
  .max(500, "That doesn't look right — please check this value.");

export const correctionRequestSchema = z.object({
  adminNotes: z.string().trim().min(1, "Explain what needs correcting.").max(1000),
});

import { z } from "zod";

const BUSINESS_START_HOUR = 10;
const BUSINESS_END_HOUR = 18;

// <input type="datetime-local"> produces "YYYY-MM-DDTHH:mm" with no
// timezone — there's no configured store timezone anywhere in this app to
// convert against, and the customer's own browser timezone isn't
// necessarily the right one to use either (an in-person/UK-atelier
// appointment is naturally in the store's local time, not the visitor's).
// Treating it as literal wall-clock text — parsed and validated as a
// string, never through a Date object's timezone-dependent getHours() —
// is the one approach that behaves identically regardless of what
// timezone the server happens to run in. Stored with a fixed "Z" suffix
// so the same input always round-trips to the same value.
const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export const bookConsultationSchema = z.object({
  consultationTypeId: z.string().trim().min(1, "Choose a consultation type."),
  scheduledAt: z
    .string()
    .trim()
    .min(1, "Choose a date and time.")
    .transform((value, ctx) => {
      const match = value.match(DATETIME_LOCAL_PATTERN);
      if (!match) {
        ctx.addIssue({ code: "custom", message: "Choose a valid date and time." });
        return z.NEVER;
      }
      const hour = Number(match[4]);
      if (hour < BUSINESS_START_HOUR || hour >= BUSINESS_END_HOUR) {
        ctx.addIssue({
          code: "custom",
          message: `Choose a time between ${BUSINESS_START_HOUR}:00 and ${BUSINESS_END_HOUR}:00.`,
        });
        return z.NEVER;
      }
      const isoUtc = `${value}:00Z`;
      if (new Date(isoUtc).getTime() <= Date.now()) {
        ctx.addIssue({ code: "custom", message: "Choose a time in the future." });
        return z.NEVER;
      }
      return isoUtc;
    }),
  contactName: z.string().trim().min(2, "Enter your name.").max(200),
  contactEmail: z.string().trim().email("Enter a valid email address."),
  contactPhone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
});

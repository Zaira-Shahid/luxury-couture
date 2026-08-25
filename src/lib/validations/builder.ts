import { z } from "zod";

/**
 * An unset builder choice. Accepts a string, "", undefined OR **null**,
 * and normalises every empty form to null.
 *
 * THE `null` IS THE WHOLE POINT, and its absence was a real bug that
 * broke the builder from Module 6 until it was found.
 *
 * BuilderShell keeps its selections as `Selections`, where every unchosen
 * field is initialised to `null` (`config?.fabric_id ?? null`). It then
 * posts that whole object to createConfiguration/updateConfiguration on
 * every Next and Save Draft. This schema previously accepted
 * `string | undefined | ""` only, so a payload with even ONE unchosen
 * option — which is every payload before the last step — failed
 * validation with "Invalid input".
 *
 * The visible effect was that Next silently refused to advance and the
 * estimated price stayed at £0.00, because the server action returned
 * early and the price RPC was never reached. The RPCs themselves were
 * always fine, which is exactly why test-builder-rpcs.mjs passed
 * throughout: it exercises the database functions directly and never
 * crosses this schema. test-builder-validation.mjs now covers the gap.
 */
const optionalId = z
  .string()
  .trim()
  .nullish()
  .or(z.literal(""))
  .transform((value) => (value ? value : null));

export const builderSelectionsSchema = z.object({
  productId: optionalId,
  fabricId: optionalId,
  embroideryTypeId: optionalId,
  colourId: optionalId,
  sleeveStyleId: optionalId,
  necklineId: optionalId,
  dupattaOptionId: optionalId,
  customNotes: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
});

export const requestQuotationSchema = z.object({
  contactName: z.string().trim().min(2, "Enter your name.").max(200),
  contactEmail: z.string().trim().email("Enter a valid email address."),
  contactPhone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
});

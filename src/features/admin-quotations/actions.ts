"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { notify } from "@/lib/notifications/notify";
import { quoteCreatedTemplate } from "@/lib/notifications/templates";
import { createClient } from "@/lib/supabase/server";
import { createQuotationSchema } from "@/lib/validations/admin-quotations";

export type ActionResult = { error: string } | { success: true };

export async function createQuotation(enquiryId: string, formData: FormData): Promise<ActionResult> {
  const parsed = createQuotationSchema.safeParse({
    quotedPrice: formData.get("quotedPrice"),
    depositPercentage: formData.get("depositPercentage"),
    validUntil: formData.get("validUntil"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: enquiry } = await supabase
    .from("enquiries")
    .select("customer_id, contact_email")
    .eq("id", enquiryId)
    .single();
  if (!enquiry) return { error: "Enquiry not found." };

  // Relies on the regular is_admin() RLS path (quotations for insert with
  // check (is_admin())) — same as every other admin write in this project,
  // no service-role needed to *create* a quote (only accepting one needs
  // it, since that's a customer-triggered transition on an admin-only
  // table).
  const { error } = await supabase.from("quotations").insert({
    enquiry_id: enquiryId,
    customer_id: enquiry.customer_id,
    quoted_price: parsed.data.quotedPrice,
    deposit_percentage: parsed.data.depositPercentage,
    deposit_amount:
      parsed.data.depositPercentage != null
        ? Number(((parsed.data.quotedPrice * parsed.data.depositPercentage) / 100).toFixed(2))
        : null,
    valid_until: parsed.data.validUntil,
    notes: parsed.data.notes,
    status: "sent",
    created_by: user.id,
  });

  if (error) {
    logger.error("quotation creation failed", error, { enquiryId });
    return { error: "Could not create the quotation. Please try again." };
  }

  await supabase.from("enquiries").update({ status: "quoted" }).eq("id", enquiryId);

  await notify(supabase, {
    profileId: enquiry.customer_id,
    email: enquiry.contact_email,
    ...quoteCreatedTemplate(parsed.data.quotedPrice, "GBP"),
  });

  revalidatePath(`/admin/enquiries/${enquiryId}`);
  return { success: true };
}

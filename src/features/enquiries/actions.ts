"use server";

import { trackServer } from "@/lib/analytics/track-server";
import { logger } from "@/lib/logger";
import { notify } from "@/lib/notifications/notify";
import { enquiryReceivedTemplate } from "@/lib/notifications/templates";
import { createClient } from "@/lib/supabase/server";
import { productEnquirySchema } from "@/lib/validations/enquiries";

export type ActionResult = { error: string } | { success: true };

export async function submitProductEnquiry(
  productName: string,
  productSlug: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = productEnquirySchema.safeParse({
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No .select() deliberately: after the Module 5 guest-read-leak fix,
  // guests (customer_id null) can never pass the SELECT policy for their
  // own row, and Postgres requires RETURNING output to satisfy it too —
  // same RETURNING/RLS interaction documented for newsletter signups.
  const { error } = await supabase.from("enquiries").insert({
    customer_id: user?.id ?? null,
    type: "general",
    contact_name: parsed.data.contactName,
    contact_email: parsed.data.contactEmail,
    contact_phone: parsed.data.contactPhone,
    message: `Enquiry about "${productName}" (/products/${productSlug}):\n\n${parsed.data.message}`,
  });

  if (error) {
    logger.error("product enquiry submission failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  await notify(supabase, {
    profileId: user?.id ?? null,
    email: user?.email ?? parsed.data.contactEmail,
    phone: parsed.data.contactPhone || null,
    ...enquiryReceivedTemplate(),
  });

  await trackServer("enquiry_submitted", { enquiryType: "general", productSlug });

  return { success: true };
}

"use server";

import { logger } from "@/lib/logger";
import { notify } from "@/lib/notifications/notify";
import { enquiryReceivedTemplate } from "@/lib/notifications/templates";
import { createClient } from "@/lib/supabase/server";
import { enquirySchema } from "@/lib/validations/contact";

export type ActionResult = { error: string } | { success: true };

export async function submitEnquiry(formData: FormData): Promise<ActionResult> {
  const parsed = enquirySchema.safeParse({
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    message: formData.get("message"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No .select() deliberately — guests can never pass enquiries' SELECT
  // policy for their own row (0021), and Postgres requires RETURNING
  // output to satisfy it too. Same documented pattern as newsletter
  // signups, product enquiries, and builder quotation requests.
  const { error } = await supabase.from("enquiries").insert({
    customer_id: user?.id ?? null,
    type: "general",
    contact_name: parsed.data.contactName,
    contact_email: parsed.data.contactEmail,
    contact_phone: parsed.data.contactPhone,
    message: parsed.data.message,
  });

  if (error) {
    logger.error("enquiry submission failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  await notify(supabase, {
    profileId: user?.id ?? null,
    email: user?.email ?? parsed.data.contactEmail,
    phone: parsed.data.contactPhone || null,
    ...enquiryReceivedTemplate(),
  });

  return { success: true };
}

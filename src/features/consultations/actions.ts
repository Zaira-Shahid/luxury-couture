"use server";

import { revalidatePath } from "next/cache";

import { trackServer } from "@/lib/analytics/track-server";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { bookConsultationSchema } from "@/lib/validations/consultations";
import { checkRateLimit } from "@/lib/security/rate-limit";

export type ActionResult = { error: string } | { success: true };

export async function bookConsultation(formData: FormData): Promise<ActionResult> {
  // MODULE 29: this endpoint is anonymous, writes a row and sends
  // mail. Unlimited, a trivial loop meant unbounded rows plus
  // outbound email from this domain — a deliverability problem as
  // much as a database one. Checked BEFORE any work is done.
  const limited = await checkRateLimit(
    "consultation",
    5,
    "You have requested several appointments recently. Please wait a few minutes before booking another."
  );
  if (!limited.allowed) return { error: limited.message };

  const parsed = bookConsultationSchema.safeParse({
    consultationTypeId: formData.get("consultationTypeId"),
    scheduledAt: formData.get("scheduledAt"),
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();

  const { data: consultationType } = await supabase
    .from("consultation_types")
    .select("duration_minutes")
    .eq("id", parsed.data.consultationTypeId)
    .single();
  if (!consultationType) return { error: "That consultation type is no longer available." };

  const requestedStart = new Date(parsed.data.scheduledAt);
  const requestedEnd = new Date(requestedStart.getTime() + consultationType.duration_minutes * 60_000);

  // Checking for a scheduling conflict means reading *other* customers'
  // booked slots, which owner-or-admin RLS (0028) correctly no longer
  // allows a regular caller to do — this is a narrow, read-only use of
  // the service-role client for exactly that reason, and only pulls the
  // timing fields, never contact info, into memory.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("appointments")
    .select("scheduled_at, duration_minutes")
    .in("status", ["requested", "confirmed"])
    .gte("scheduled_at", new Date(requestedStart.getTime() - 4 * 60 * 60_000).toISOString())
    .lte("scheduled_at", requestedEnd.toISOString());

  const hasConflict = (existing ?? []).some((appt) => {
    const otherStart = new Date(appt.scheduled_at);
    const otherEnd = new Date(otherStart.getTime() + appt.duration_minutes * 60_000);
    return requestedStart < otherEnd && otherStart < requestedEnd;
  });
  if (hasConflict) {
    return { error: "That time is no longer available. Please choose another slot." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No .select() deliberately — same RETURNING/RLS pattern as enquiries.
  const { error } = await supabase.from("appointments").insert({
    customer_id: user?.id ?? null,
    type: "consultation",
    consultation_type_id: parsed.data.consultationTypeId,
    scheduled_at: parsed.data.scheduledAt,
    duration_minutes: consultationType.duration_minutes,
    contact_name: parsed.data.contactName,
    contact_email: parsed.data.contactEmail,
    contact_phone: parsed.data.contactPhone,
    notes: parsed.data.notes,
  });

  if (error) {
    logger.error("consultation booking failed", error);
    return { error: "Could not book that appointment. Please try again." };
  }

  await trackServer("consultation_booked", {
    appointmentType: "consultation",
    consultationTypeId: parsed.data.consultationTypeId,
  });

  revalidatePath("/account/consultations");
  return { success: true };
}

export async function cancelAppointment(appointmentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .eq("customer_id", user.id);

  if (error) {
    logger.error("appointment cancel failed", error, { appointmentId });
    return { error: "Could not cancel. Please try again." };
  }

  revalidatePath("/account/consultations");
  return { success: true };
}

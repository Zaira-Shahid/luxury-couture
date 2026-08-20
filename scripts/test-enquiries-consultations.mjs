import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const suffix = Date.now();

async function check(label, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);
}

async function signIn(email, password) {
  const client = createClient(url, anonKey);
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await client.auth.signInWithPassword({ email, password });
  return { client, userId: data.user.id };
}

console.log("=== General enquiry (guest) ===");
const guest = createClient(url, anonKey);
const { error: enquiryErr } = await guest.from("enquiries").insert({
  type: "general",
  contact_name: "Enquiry Test",
  contact_email: `m9-enquiry-${suffix}@example.com`,
  message: "Do you ship internationally?",
});
await check("guest can submit a general enquiry", !enquiryErr);

const { data: enquiryRow } = await admin
  .from("enquiries")
  .select("*")
  .eq("contact_email", `m9-enquiry-${suffix}@example.com`)
  .single();
await check("enquiry persisted with status=new", enquiryRow?.status === "new");

console.log("\n=== Consultation booking: guest + overlap check ===");
const { data: consultationType } = await admin
  .from("consultation_types")
  .select("id, duration_minutes")
  .eq("slug", "virtual-design")
  .single();
await check("seeded consultation type is readable", !!consultationType);

const scheduledAt = "2030-06-15T14:00:00Z"; // fixed far-future date, business hours
const { error: bookErr } = await guest.from("appointments").insert({
  type: "consultation",
  consultation_type_id: consultationType.id,
  scheduled_at: scheduledAt,
  duration_minutes: consultationType.duration_minutes,
  contact_name: "Booking Test",
  contact_email: `m9-booking-${suffix}@example.com`,
});
await check("guest can book a consultation with contact info", !bookErr);

// Simulate the overlap check the Server Action performs (service-role read).
const requestedStart = new Date(scheduledAt);
const requestedEnd = new Date(requestedStart.getTime() + consultationType.duration_minutes * 60_000);
const { data: existingForOverlap } = await admin
  .from("appointments")
  .select("scheduled_at, duration_minutes")
  .in("status", ["requested", "confirmed"])
  .gte("scheduled_at", new Date(requestedStart.getTime() - 4 * 3600_000).toISOString())
  .lte("scheduled_at", requestedEnd.toISOString());
const hasConflict = (existingForOverlap ?? []).some((appt) => {
  const otherStart = new Date(appt.scheduled_at);
  const otherEnd = new Date(otherStart.getTime() + appt.duration_minutes * 60_000);
  return requestedStart < otherEnd && otherStart < requestedEnd;
});
await check("overlap check correctly detects the slot is now taken", hasConflict);

console.log("\n=== Guest-scan leak re-confirmation (appointments) ===");
const stranger = createClient(url, anonKey);
const { data: scanResult } = await stranger.from("appointments").select("id, notes, contact_email");
await check("blind table scan by an anonymous visitor returns nothing", (scanResult?.length ?? 0) === 0);

console.log("\n=== Admin flow: real admin vs non-admin ===");
const staffAdmin = await signIn(`m9-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-20");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);
const customer = await signIn(`m9-customer-${suffix}@luxury-couture-devtest.local`, "correct-horse-21");

const { data: bookingRow } = await admin
  .from("appointments")
  .select("id")
  .eq("contact_email", `m9-booking-${suffix}@example.com`)
  .single();

const { error: nonAdminStatusErr } = await customer.client
  .from("appointments")
  .update({ status: "confirmed" })
  .eq("id", bookingRow.id);
const { data: afterNonAdmin } = await admin.from("appointments").select("status").eq("id", bookingRow.id).single();
await check(
  "non-admin's status change is a no-op (RLS-filtered, not an error)",
  !nonAdminStatusErr && afterNonAdmin.status === "requested"
);

const { error: adminStatusErr } = await staffAdmin.client
  .from("appointments")
  .update({ status: "confirmed" })
  .eq("id", bookingRow.id);
const { data: afterAdmin } = await admin.from("appointments").select("status").eq("id", bookingRow.id).single();
await check("real admin can confirm the appointment", !adminStatusErr && afterAdmin.status === "confirmed");

const { error: adminEnquiryStatusErr } = await staffAdmin.client
  .from("enquiries")
  .update({ status: "in_review", assigned_admin_id: staffAdmin.userId })
  .eq("id", enquiryRow.id);
const { data: afterEnquiryUpdate } = await admin
  .from("enquiries")
  .select("status, assigned_admin_id")
  .eq("id", enquiryRow.id)
  .single();
await check(
  "real admin can triage the enquiry (status + assignment)",
  !adminEnquiryStatusErr &&
    afterEnquiryUpdate.status === "in_review" &&
    afterEnquiryUpdate.assigned_admin_id === staffAdmin.userId
);

console.log("\n=== Signed-in customer booking (own appointment visible, others not) ===");
const { error: customerBookErr } = await customer.client.from("appointments").insert({
  customer_id: customer.userId,
  type: "consultation",
  consultation_type_id: consultationType.id,
  scheduled_at: "2030-06-16T11:00:00Z",
  duration_minutes: consultationType.duration_minutes,
  contact_name: "Customer Test",
  contact_email: `m9-customer-${suffix}@luxury-couture-devtest.local`,
});
await check("signed-in customer can book their own appointment", !customerBookErr);

const { data: ownAppointments } = await customer.client
  .from("appointments")
  .select("id")
  .eq("customer_id", customer.userId);
await check("customer sees their own appointment", ownAppointments?.length === 1);

const { data: crossCheck } = await customer.client.from("appointments").select("id").eq("id", bookingRow.id);
await check("customer cannot see the unrelated guest booking", (crossCheck?.length ?? 0) === 0);

console.log("\nCleaning up...");
await admin.from("appointments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
await admin.from("enquiries").delete().eq("id", enquiryRow.id);
await admin.auth.admin.deleteUser(staffAdmin.userId);
await admin.auth.admin.deleteUser(customer.userId);

const [{ data: remainingAppointments }, { data: remainingEnquiries }, { data: users }] = await Promise.all([
  admin.from("appointments").select("id"),
  admin.from("enquiries").select("id").eq("contact_email", `m9-enquiry-${suffix}@example.com`),
  admin.auth.admin.listUsers(),
]);
console.log(
  `Remaining — appointments: ${remainingAppointments.length}, test enquiry: ${remainingEnquiries.length}, auth users: ${users.users.length} (should be 0, 0, 1)`
);

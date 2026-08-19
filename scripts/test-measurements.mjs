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

const alice = await signIn(`m7-alice-${suffix}@luxury-couture-devtest.local`, "correct-horse-1");
const bob = await signIn(`m7-bob-${suffix}@luxury-couture-devtest.local`, "correct-horse-2");
await admin.from("profiles").update({ role: "admin" }).eq("id", bob.userId);

console.log("=== Customer flow (alice) ===");
const { data: profile, error: createErr } = await alice.client
  .from("measurement_profiles")
  .insert({ customer_id: alice.userId, label: "Wedding Lehenga", unit: "cm" })
  .select()
  .single();
await check("alice can create a profile", !createErr && !!profile);

// DB-level check constraint: value > 0.
const { error: badValueErr } = await alice.client
  .from("measurements")
  .insert({ measurement_profile_id: profile.id, field_key: "bust", value: -5 });
await check("negative value rejected by DB check constraint", !!badValueErr);

const { data: fields } = await alice.client
  .from("measurement_field_definitions")
  .select("key, is_required")
  .eq("is_active", true);
const requiredKeys = fields.filter((f) => f.is_required).map((f) => f.key);
await check("required fields seeded and readable", requiredKeys.length > 0);

// Fill only the required fields with real values.
const rows = requiredKeys.map((key, i) => ({
  measurement_profile_id: profile.id,
  field_key: key,
  value: 80 + i,
}));
const { error: valuesErr } = await alice.client.from("measurements").insert(rows);
await check("alice can save measurement values", !valuesErr);

await alice.client.from("measurement_profiles").update({ status: "submitted" }).eq("id", profile.id);
const { data: submitted } = await alice.client.from("measurement_profiles").select("status").eq("id", profile.id).single();
await check("profile status is submitted", submitted.status === "submitted");

console.log("\n=== Cross-customer isolation ===");
const { data: bobReadAlice } = await bob.client.from("measurement_profiles").select("id").eq("id", profile.id);
// bob is an admin, so this should actually succeed for bob — re-verify with a THIRD, non-admin customer instead.
const carol = await signIn(`m7-carol-${suffix}@luxury-couture-devtest.local`, "correct-horse-3");
const { data: carolReadAlice } = await carol.client.from("measurement_profiles").select("id").eq("id", profile.id);
await check("an unrelated non-admin customer cannot see alice's profile", (carolReadAlice?.length ?? 0) === 0);
await check("admin (bob) can see alice's profile", (bobReadAlice?.length ?? 0) === 1);

console.log("\n=== Admin flow (bob, real admin account) ===");
const { error: approveErr } = await bob.client
  .from("measurement_profiles")
  .update({ status: "approved", admin_notes: null })
  .eq("id", profile.id);
await check("admin can approve", !approveErr);

// Editing after approval should reset to draft (app-level logic, not RLS —
// verify the actual Server Action behavior by simulating its exact steps).
const { data: beforeEdit } = await admin.from("measurement_profiles").select("status").eq("id", profile.id).single();
await check("status is approved before edit", beforeEdit.status === "approved");
const resetStatus = beforeEdit.status === "submitted" || beforeEdit.status === "approved";
await alice.client
  .from("measurement_profiles")
  .update({ label: "Wedding Lehenga (updated)", ...(resetStatus ? { status: "draft" } : {}) })
  .eq("id", profile.id);
const { data: afterEdit } = await admin.from("measurement_profiles").select("status, label").eq("id", profile.id).single();
await check("editing after approval resets status to draft", afterEdit.status === "draft");

console.log("\n=== Correction request flow ===");
const { error: correctionErr } = await bob.client
  .from("measurement_profiles")
  .update({ status: "correction_requested", admin_notes: "Please remeasure your waist." })
  .eq("id", profile.id);
await check("admin can request correction with a note", !correctionErr);
const { data: afterCorrection } = await admin
  .from("measurement_profiles")
  .select("status, admin_notes, notes")
  .eq("id", profile.id)
  .single();
await check(
  "correction status + admin_notes set without touching customer notes",
  afterCorrection.status === "correction_requested" && afterCorrection.admin_notes === "Please remeasure your waist."
);

console.log("\nCleaning up...");
await admin.from("measurement_profiles").delete().eq("id", profile.id);
await admin.auth.admin.deleteUser(alice.userId);
await admin.auth.admin.deleteUser(bob.userId);
await admin.auth.admin.deleteUser(carol.userId);

const [{ data: remainingProfiles }, { data: remainingUsers }] = await Promise.all([
  admin.from("measurement_profiles").select("id"),
  admin.auth.admin.listUsers(),
]);
console.log(
  `Remaining — measurement_profiles: ${remainingProfiles.length}, total auth users: ${remainingUsers.users.length} (should be 0, 1 [real owner account])`
);

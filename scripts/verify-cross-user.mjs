import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Uses the admin API (email_confirm: true) rather than the public signUp
// flow — this script is verifying RLS/ownership behavior, not email
// delivery, so it deliberately doesn't touch Supabase's (rate-limited)
// auth email sender. Email confirmation/reset itself is tested separately
// once Auth URL Configuration is set in the dashboard.
async function createAndSignIn(email, password) {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw new Error(`createUser failed: ${createErr.message}`);

  const client = createClient(url, anonKey);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn failed: ${signInErr.message}`);

  return { client, userId: created.user.id };
}

const suffix = Date.now();
const alice = await createAndSignIn(`alice-${suffix}@luxury-couture-devtest.local`, "correct-horse-battery-1");
const bob = await createAndSignIn(`bob-${suffix}@luxury-couture-devtest.local`, "correct-horse-battery-2");

// Give the handle_new_user trigger a moment to run.
await new Promise((r) => setTimeout(r, 500));

async function check(label, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);
}

// 1. Auto-created profile exists for each user.
const { data: aliceOwnProfile } = await alice.client.from("profiles").select("*").eq("id", alice.userId);
await check("handle_new_user trigger created alice's profile row", aliceOwnProfile?.length === 1);

// 2. Alice can update her own profile.
const { error: updateOwnErr } = await alice.client
  .from("profiles")
  .update({ full_name: "Alice Test" })
  .eq("id", alice.userId);
await check("alice can update her own profile", !updateOwnErr);

// 3. Alice cannot read Bob's profile row (RLS should hide it, not error).
const { data: aliceViewingBob } = await alice.client.from("profiles").select("*").eq("id", bob.userId);
await check("alice cannot see bob's profile row", (aliceViewingBob?.length ?? 0) === 0);

// 4. Alice cannot update Bob's profile.
const { data: hijackAttempt } = await alice.client
  .from("profiles")
  .update({ full_name: "Hijacked" })
  .eq("id", bob.userId)
  .select();
await check("alice cannot update bob's profile", (hijackAttempt?.length ?? 0) === 0);

// 5. Alice cannot self-promote to admin (role column update revoked).
const { error: promoteErr } = await alice.client
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", alice.userId);
await check("alice cannot self-promote her own role to admin", !!promoteErr);

// 6. Addresses: alice can create her own, bob cannot see it.
const { data: aliceAddress, error: addrErr } = await alice.client
  .from("addresses")
  .insert({
    customer_id: alice.userId,
    recipient_name: "Alice",
    line1: "1 Test St",
    city: "London",
    postal_code: "E1 1AA",
    country: "UK",
  })
  .select();
await check("alice can create her own address", !addrErr && aliceAddress?.length === 1);

const { data: bobViewingAliceAddress } = await bob.client
  .from("addresses")
  .select("*")
  .eq("customer_id", alice.userId);
await check("bob cannot see alice's address", (bobViewingAliceAddress?.length ?? 0) === 0);

// Cleanup — delete both test users via the admin client.
await admin.auth.admin.deleteUser(alice.userId);
await admin.auth.admin.deleteUser(bob.userId);
console.log("\nCleaned up both test users.");

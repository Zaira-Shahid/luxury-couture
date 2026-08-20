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

// Real seeded lookup rows (Module 1) — using actual data, not guessed ids.
const { data: fabric } = await admin.from("fabrics").select("id, price_adjustment").limit(1).single();
const { data: embroidery } = await admin
  .from("embroidery_types")
  .select("id, price_adjustment")
  .limit(1)
  .single();
const { data: colour } = await admin.from("colours").select("id, price_adjustment").limit(1).single();

console.log("=== Guest flow (anon, no session) ===");
const guest = createClient(url, anonKey);

const { data: created, error: createErr } = await guest.rpc("create_builder_configuration", {
  p_fabric_id: fabric.id,
  p_embroidery_type_id: embroidery.id,
  p_custom_notes: "Module6 guest test notes",
});
await check("guest can create a configuration via RPC", !createErr && !!created);
const expectedPrice = Number(fabric.price_adjustment) + Number(embroidery.price_adjustment);
await check(
  `estimated_price is server-computed correctly (${created?.estimated_price} == ${expectedPrice})`,
  Number(created?.estimated_price) === expectedPrice
);
await check("customer_id is null for a guest-created configuration", created?.customer_id === null);

const configId = created.id;
const token = created.share_token;

// Wrong token must fail.
const { data: wrongTokenResult } = await guest.rpc("get_builder_configuration", {
  p_id: configId,
  p_token: "00000000-0000-0000-0000-000000000000",
});
await check("wrong token returns nothing", (wrongTokenResult?.length ?? 0) === 0);

// Correct token succeeds, from a totally different anonymous session.
const otherGuest = createClient(url, anonKey);
const { data: fetched } = await otherGuest.rpc("get_builder_configuration", {
  p_id: configId,
  p_token: token,
});
await check("correct id+token retrieves it from an unrelated session", fetched?.[0]?.id === configId);

// Attempted price manipulation: pass different option ids, confirm the
// server recomputes from scratch rather than trusting anything client-side
// (there's no price parameter to even pass — this proves the point
// structurally, not just by testing a rejected value).
const { data: updated, error: updateErr } = await guest.rpc("update_builder_configuration", {
  p_id: configId,
  p_token: token,
  p_fabric_id: fabric.id,
  p_embroidery_type_id: embroidery.id,
  p_colour_id: colour.id,
  p_custom_notes: "Module6 guest test notes, updated",
});
const expectedPrice2 = Number(fabric.price_adjustment) + Number(embroidery.price_adjustment) + Number(colour.price_adjustment);
await check("guest can update via RPC with correct token", !updateErr);
await check(
  `price recomputed after update (${updated?.estimated_price} == ${expectedPrice2})`,
  Number(updated?.estimated_price) === expectedPrice2
);

// Wrong token on update must fail.
const { error: badUpdateErr } = await guest.rpc("update_builder_configuration", {
  p_id: configId,
  p_token: "00000000-0000-0000-0000-000000000000",
  p_custom_notes: "should not apply",
});
await check("update with wrong token is rejected", !!badUpdateErr);

// Inspiration image via RPC. Module 8 added p_storage_path (real Storage
// objects, not pasted URLs) — this test only exercises the DB/RPC layer,
// so a placeholder path is fine; scripts/test-storage.mjs covers the real
// upload/delete path against actual Storage.
const { data: image, error: imageErr } = await guest.rpc("add_inspiration_image", {
  p_config_id: configId,
  p_token: token,
  p_url: "https://example.com/inspiration.jpg",
  p_storage_path: "inspiration/test-placeholder.jpg",
});
await check("guest can add an inspiration image via RPC", !imageErr && !!image);

console.log("\n=== Claim flow (guest signs in, claims the design) ===");
const { data: customerUser } = await admin.auth.admin.createUser({
  email: `module6-customer-${suffix}@luxury-couture-devtest.local`,
  password: "correct-horse-battery-10",
  email_confirm: true,
});
const customer = createClient(url, anonKey);
await customer.auth.signInWithPassword({
  email: customerUser.user.email,
  password: "correct-horse-battery-10",
});

const { data: claimed, error: claimErr } = await customer.rpc("claim_builder_configuration", {
  p_id: configId,
  p_token: token,
});
await check("signed-in user can claim the guest design", !claimErr && claimed?.customer_id === customerUser.user.id);

// Claiming again should fail (already claimed).
const otherCustomerClient = createClient(url, anonKey);
const { data: otherCustomer } = await admin.auth.admin.createUser({
  email: `module6-other-${suffix}@luxury-couture-devtest.local`,
  password: "correct-horse-battery-11",
  email_confirm: true,
});
await otherCustomerClient.auth.signInWithPassword({
  email: otherCustomer.user.email,
  password: "correct-horse-battery-11",
});
const { error: reClaimErr } = await otherCustomerClient.rpc("claim_builder_configuration", {
  p_id: configId,
  p_token: token,
});
await check("a second account cannot claim an already-claimed design", !!reClaimErr);

// Now that it's claimed, the owner can read it directly via normal RLS
// (no token needed) — and a stranger still cannot.
const { data: ownerDirectRead } = await customer.from("builder_configurations").select("id").eq("id", configId);
await check("owner can now read it directly via RLS (no token)", ownerDirectRead?.length === 1);

const strangerClient = createClient(url, anonKey);
const { data: strangerRead } = await strangerClient.from("builder_configurations").select("id").eq("id", configId);
await check("an anonymous stranger still cannot read it directly", (strangerRead?.length ?? 0) === 0);

console.log("\n=== Guest-scan leak re-confirmation ===");
const scanClient = createClient(url, anonKey);
const { data: scanResult } = await scanClient.from("builder_configurations").select("id, custom_notes, share_token");
await check("blind table scan by an anonymous visitor returns nothing", (scanResult?.length ?? 0) === 0);

console.log("\nCleaning up...");
await admin.from("inspiration_images").delete().eq("builder_configuration_id", configId);
await admin.from("builder_configurations").delete().eq("id", configId);
await admin.auth.admin.deleteUser(customerUser.user.id);
await admin.auth.admin.deleteUser(otherCustomer.user.id);

const [{ data: bc }, { data: ii }, { data: users }] = await Promise.all([
  admin.from("builder_configurations").select("id"),
  admin.from("inspiration_images").select("id"),
  admin.auth.admin.listUsers(),
]);
console.log(
  `Remaining — builder_configurations: ${bc.length}, inspiration_images: ${ii.length}, total auth users: ${users.users.length} (should be 0, 0, 1 [the real owner account])`
);

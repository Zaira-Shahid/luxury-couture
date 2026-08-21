import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const suffix = Date.now();

async function check(label, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);
}

async function signIn(email, password) {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const { data: signInData } = await client.auth.signInWithPassword({ email, password });
  return { client, userId: data.user.id, session: signInData.session };
}

function projectRef() {
  return new URL(url).hostname.split(".")[0];
}
function sessionCookieHeader(session) {
  const b64url = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `sb-${projectRef()}-auth-token=base64-${b64url}`;
}

console.log("=== Setup: admin + customer ===");
const staffAdmin = await signIn(`m17-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-a0");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);
const customer = await signIn(`m17-customer-${suffix}@luxury-couture-devtest.local`, "correct-horse-a1");

console.log("\n=== Builder options: admin CRUD across the six identically-shaped tables ===");
const { data: fabric, error: createFabricErr } = await staffAdmin.client
  .from("fabrics")
  .insert({ name: "Test Silk", slug: `test-silk-${suffix}`, price_adjustment: 50, is_active: true, sort_order: 99 })
  .select()
  .single();
await check("admin can create a fabric", !createFabricErr && !!fabric);

const { data: colour, error: createColourErr } = await staffAdmin.client
  .from("colours")
  .insert({ name: "Test Emerald", slug: `test-emerald-${suffix}`, hex_value: "#046307", price_adjustment: 10, is_active: false, sort_order: 99 })
  .select()
  .single();
await check("admin can create a colour (different shape — hex_value, not description)", !createColourErr && !!colour);

const { error: customerCreateErr } = await customer.client
  .from("fabrics")
  .insert({ name: "Should fail", slug: `should-fail-${suffix}`, price_adjustment: 0 });
await check("a plain customer cannot create a fabric", !!customerCreateErr);

const { data: publicSeesActive } = await customer.client.from("fabrics").select("id").eq("id", fabric.id);
await check("an active fabric is publicly readable", (publicSeesActive?.length ?? 0) === 1);
const { data: publicSeesInactive } = await customer.client.from("colours").select("id").eq("id", colour.id);
await check("an inactive colour is NOT publicly readable", (publicSeesInactive?.length ?? 0) === 0);
const { data: adminSeesInactive } = await staffAdmin.client.from("colours").select("id").eq("id", colour.id);
await check("admin CAN read the inactive colour", (adminSeesInactive?.length ?? 0) === 1);

console.log("\n=== Builder pricing: editing price_adjustment changes computed price live, no separate recalc step ===");
const { data: priceBefore } = await admin.rpc("compute_builder_estimated_price", {
  p_product_id: null,
  p_fabric_id: fabric.id,
  p_embroidery_type_id: null,
  p_colour_id: null,
  p_sleeve_style_id: null,
  p_neckline_id: null,
  p_dupatta_option_id: null,
});
await check("initial computed price reflects the fabric's price_adjustment (50)", Number(priceBefore) === 50);

await staffAdmin.client.from("fabrics").update({ price_adjustment: 75 }).eq("id", fabric.id);
const { data: priceAfter } = await admin.rpc("compute_builder_estimated_price", {
  p_product_id: null,
  p_fabric_id: fabric.id,
  p_embroidery_type_id: null,
  p_colour_id: null,
  p_sleeve_style_id: null,
  p_neckline_id: null,
  p_dupatta_option_id: null,
});
await check("updated price_adjustment (75) is reflected immediately, no recalculation step", Number(priceAfter) === 75);

const { error: deleteErr } = await staffAdmin.client.from("colours").delete().eq("id", colour.id);
await check("admin can delete a builder option", !deleteErr);

console.log("\n=== Inventory: admin-only RLS ===");
const { data: inventoryItem, error: inventoryCreateErr } = await staffAdmin.client
  .from("inventory_items")
  .insert({ category: "fabric", fabric_id: fabric.id, name: "Test Silk stock", unit: "meters", stock_quantity: 20, reserved_quantity: 5, low_stock_threshold: 10 })
  .select()
  .single();
await check("admin can create an inventory item linked to a fabric", !inventoryCreateErr && !!inventoryItem);

const { error: customerInventoryErr } = await customer.client.from("inventory_items").insert({ category: "material", name: "Should fail", unit: "meters" });
await check("a plain customer cannot create an inventory item", !!customerInventoryErr);

const { data: customerBlindScan } = await customer.client.from("inventory_items").select("id");
await check("a plain customer's unfiltered inventory scan returns nothing", (customerBlindScan?.length ?? 0) === 0);

const { data: adminReadsItem } = await staffAdmin.client.from("inventory_items").select("*").eq("id", inventoryItem.id).single();
const available = Number(adminReadsItem.stock_quantity) - Number(adminReadsItem.reserved_quantity);
await check("low-stock boundary: 20 stock - 5 reserved = 15 available, threshold 10 -> NOT low stock", available === 15 && available > Number(adminReadsItem.low_stock_threshold));

await staffAdmin.client.from("inventory_items").update({ reserved_quantity: 12 }).eq("id", inventoryItem.id);
const { data: afterReserve } = await staffAdmin.client.from("inventory_items").select("stock_quantity, reserved_quantity, low_stock_threshold").eq("id", inventoryItem.id).single();
const availableAfter = Number(afterReserve.stock_quantity) - Number(afterReserve.reserved_quantity);
await check("low-stock boundary: 20 stock - 12 reserved = 8 available, threshold 10 -> IS low stock", availableAfter === 8 && availableAfter <= Number(afterReserve.low_stock_threshold));

console.log("\n=== Live nav-link resolution: real authenticated session, same technique as Module 16 ===");
const cookie = sessionCookieHeader(staffAdmin.session);
const routes = [
  "/admin/builder",
  "/admin/builder/fabrics",
  "/admin/builder/fabrics/new",
  `/admin/builder/fabrics/${fabric.id}/edit`,
  "/admin/builder/colours",
  "/admin/builder/embroidery_types",
  "/admin/builder/sleeve_styles",
  "/admin/builder/necklines",
  "/admin/builder/dupatta_options",
  "/admin/inventory",
  "/admin/inventory/new",
  `/admin/inventory/${inventoryItem.id}/edit`,
  "/admin/products/new",
];
for (const route of routes) {
  const res = await fetch(`${appUrl}${route}`, { headers: { cookie }, redirect: "manual" });
  await check(`${route} resolves (200)`, res.status === 200);
}

// notFound() during page rendering is a documented Next.js 15 App Router
// characteristic in this project (see docs/ARCHITECTURE.md, Module 10):
// it produces a 200 with the not-found UI rendered client-side, not a
// genuine 404 status — the middleware-based fix for that was deliberately
// scoped to 3 public, crawled storefront pages only, not admin pages
// (behind auth, never crawled). So the correct check here is that
// notFound() actually fired (the not-found page rendered, confirming the
// invalid table never reached .from()), not the raw status code.
const badTableRes = await fetch(`${appUrl}/admin/builder/not-a-real-table`, { headers: { cookie }, redirect: "manual" });
const badTableBody = await badTableRes.text();
await check(
  "an invalid table segment renders the not-found page rather than reaching .from() unchecked",
  badTableBody.includes("Page not found")
);

console.log("\nCleaning up...");
await admin.from("inventory_items").delete().eq("id", inventoryItem.id);
await admin.from("fabrics").delete().eq("id", fabric.id);
await admin.auth.admin.deleteUser(staffAdmin.userId);
await admin.auth.admin.deleteUser(customer.userId);

const [{ data: remainingInventory }, { data: users }] = await Promise.all([
  admin.from("inventory_items").select("id"),
  admin.auth.admin.listUsers(),
]);
console.log(`Remaining — inventory_items: ${remainingInventory.length}, auth users: ${users.users.length} (should reflect pre-existing state only)`);

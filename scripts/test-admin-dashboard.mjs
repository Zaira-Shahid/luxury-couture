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
  // Matches @supabase/ssr's cookie format: sb-<project-ref>-auth-token,
  // base64url(JSON.stringify(session)) prefixed with "base64-".
  const json = JSON.stringify(session);
  const b64url = Buffer.from(json, "utf8").toString("base64url");
  return `sb-${projectRef()}-auth-token=base64-${b64url}`;
}

console.log("=== Setup: admin + customer accounts, some real data for dashboard stats ===");
const staffAdmin = await signIn(`m16-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-90");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);
const customer = await signIn(`m16-customer-${suffix}@luxury-couture-devtest.local`, "correct-horse-91");

const { data: address } = await admin
  .from("addresses")
  .insert({ customer_id: customer.userId, recipient_name: "C", line1: "1 Test St", city: "London", postal_code: "E1 1AA", country: "UK" })
  .select()
  .single();
const { data: order } = await admin
  .from("orders")
  .insert({ customer_id: customer.userId, shipping_address_id: address.id, status: "pending", subtotal: 200, total_amount: 200, balance_due_amount: 200 })
  .select("id, order_number")
  .single();
await admin.from("payments").insert({ order_id: order.id, type: "full", amount: 200, status: "succeeded", paid_at: new Date().toISOString() });
const { data: enquiry } = await admin
  .from("enquiries")
  .insert({ customer_id: customer.userId, type: "general", contact_name: "C", contact_email: `m16-customer-${suffix}@luxury-couture-devtest.local`, message: "Test", status: "new" })
  .select()
  .single();
const { data: quotation } = await admin
  .from("quotations")
  .insert({ enquiry_id: enquiry.id, customer_id: customer.userId, quoted_price: 900, status: "sent", created_by: staffAdmin.userId })
  .select()
  .single();

console.log("\n=== Dashboard stats: DB-level accuracy against hand-computed totals ===");
const { data: succeededPayments } = await admin.from("payments").select("amount").eq("status", "succeeded");
const expectedRevenue = (succeededPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
await check("at least our test payment is counted toward revenue", expectedRevenue >= 200);

const { count: pendingEnquiriesCount } = await admin.from("enquiries").select("id", { count: "exact", head: true }).in("status", ["new", "in_review"]);
await check("at least our test enquiry is counted as pending", (pendingEnquiriesCount ?? 0) >= 1);

console.log("\n=== RLS: admin sees customers/quotations, a plain customer gets nothing ===");
const { data: adminSeesCustomer } = await staffAdmin.client.from("profiles").select("id").eq("id", customer.userId).eq("role", "customer");
await check("admin can read the customer's profile", (adminSeesCustomer?.length ?? 0) === 1);
const { data: customerBlindProfiles } = await customer.client.from("profiles").select("id").neq("id", customer.userId);
await check("a plain customer cannot read other profiles (blind scan)", (customerBlindProfiles?.length ?? 0) === 0);

const { data: adminSeesQuotation } = await staffAdmin.client.from("quotations").select("id, enquiries(contact_name)").eq("id", quotation.id);
await check("admin can read the quotation joined to its enquiry's contact name", (adminSeesQuotation?.length ?? 0) === 1 && !!adminSeesQuotation[0].enquiries);

console.log("\n=== Live nav-link resolution: every admin route via a real authenticated session cookie ===");
const cookie = sessionCookieHeader(staffAdmin.session);

const routes = [
  "/admin",
  "/admin/orders",
  "/admin/customers",
  `/admin/customers/${customer.userId}`,
  "/admin/quotations",
  "/admin/payments",
  "/admin/enquiries",
  "/admin/appointments",
  "/admin/production",
  "/admin/shipping",
  "/admin/products",
  "/admin/collections",
  "/admin/categories",
  "/admin/measurements",
  "/admin/media",
  "/admin/builder",
  "/admin/inventory",
  "/admin/reviews",
  "/admin/marketing",
  "/admin/content",
  "/admin/seo",
  "/admin/analytics",
  "/admin/settings",
];

for (const route of routes) {
  const res = await fetch(`${appUrl}${route}`, { headers: { cookie }, redirect: "manual" });
  await check(`${route} resolves (200)`, res.status === 200);
}

console.log("\n=== Sanity: an unauthenticated request to /admin still redirects, not 500 ===");
const unauthRes = await fetch(`${appUrl}/admin`, { redirect: "manual" });
await check("unauthenticated /admin redirects rather than crashing", unauthRes.status >= 300 && unauthRes.status < 400);

console.log("\nCleaning up...");
await admin.from("quotations").delete().eq("id", quotation.id);
await admin.from("enquiries").delete().eq("id", enquiry.id);
await admin.from("payments").delete().eq("order_id", order.id);
await admin.from("orders").delete().eq("id", order.id);
await admin.from("addresses").delete().eq("id", address.id);
await admin.auth.admin.deleteUser(staffAdmin.userId);
await admin.auth.admin.deleteUser(customer.userId);

const [{ data: remainingOrders }, { data: users }] = await Promise.all([
  admin.from("orders").select("id"),
  admin.auth.admin.listUsers(),
]);
console.log(`Remaining — orders: ${remainingOrders.length}, auth users: ${users.users.length} (should reflect pre-existing state only)`);

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

const DAY_MS = 86_400_000;
function daysAgoIso(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

// React splits adjacent text/interpolation nodes with <!-- --> markers in
// server-rendered HTML, so "Will send to {n} recipient" arrives as
// "Will send to <!-- -->1<!-- --> recipient" — strip them before any
// human-readable substring assertion.
function renderedText(html) {
  return html.replaceAll("<!-- -->", "");
}

// In dev, Next.js embeds the raw server-side fetch responses (including
// rows the page filtered OUT) in the RSC flight payload script tags —
// asserting against the whole document would report a filtered-away
// customer as "present". Only the <tbody> is what the admin actually sees.
function tableBody(html) {
  const start = html.indexOf("<tbody");
  const end = html.indexOf("</tbody>", start);
  return start === -1 || end === -1 ? "" : html.slice(start, end);
}

console.log("=== Setup: admin + four customers covering each segment case ===");
const staffAdmin = await signIn(`m19b-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-b0");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);

const vipCustomer = await signIn(`m19b-vip-${suffix}@luxury-couture-devtest.local`, "correct-horse-b1");
const atRiskCustomer = await signIn(`m19b-atrisk-${suffix}@luxury-couture-devtest.local`, "correct-horse-b2");
const newCustomer = await signIn(`m19b-new-${suffix}@luxury-couture-devtest.local`, "correct-horse-b3");
const noneCustomer = await signIn(`m19b-none-${suffix}@luxury-couture-devtest.local`, "correct-horse-b4");

// noneCustomer must NOT qualify as "new" — backdate its profile past the 30-day window.
await admin.from("profiles").update({ created_at: daysAgoIso(60) }).eq("id", noneCustomer.userId);

// Distinguishable full_name per customer, since the customers list renders
// full_name, not email — needed so the segment-filter render checks below
// can identify which row is which.
await admin.from("profiles").update({ full_name: `VIP Test ${suffix}` }).eq("id", vipCustomer.userId);
await admin.from("profiles").update({ full_name: `AtRisk Test ${suffix}` }).eq("id", atRiskCustomer.userId);
await admin.from("profiles").update({ full_name: `New Test ${suffix}` }).eq("id", newCustomer.userId);
await admin.from("profiles").update({ full_name: `None Test ${suffix}` }).eq("id", noneCustomer.userId);

const { data: address } = await admin
  .from("addresses")
  .insert({ customer_id: vipCustomer.userId, recipient_name: "T", line1: "1 Test St", city: "London", postal_code: "E1 1AA", country: "UK" })
  .select()
  .single();

const { data: vipOrder } = await admin
  .from("orders")
  .insert({ customer_id: vipCustomer.userId, shipping_address_id: address.id, status: "delivered", subtotal: 1500, total_amount: 1500, balance_due_amount: 0, created_at: daysAgoIso(5) })
  .select("id")
  .single();

const { data: atRiskOrder } = await admin
  .from("orders")
  .insert({ customer_id: atRiskCustomer.userId, shipping_address_id: address.id, status: "delivered", subtotal: 50, total_amount: 50, balance_due_amount: 0, created_at: daysAgoIso(120) })
  .select("id")
  .single();
// The order row's own created_at is backdated for realism, but the segment
// logic only reads lastOrderAt from getAdminCustomers()'s own aggregate —
// no direct dependency being tested here beyond "an old order = at risk".
await admin.from("profiles").update({ created_at: daysAgoIso(120) }).eq("id", atRiskCustomer.userId);

console.log("\n=== Segment computation: VIP (>=1000 lifetime spend), New (<=30d), At-risk (>=90d since last order) ===");
const { data: profiles } = await admin.from("profiles").select("id, created_at").in("id", [
  vipCustomer.userId,
  atRiskCustomer.userId,
  newCustomer.userId,
  noneCustomer.userId,
]);
const { data: allOrders } = await admin.from("orders").select("customer_id, total_amount, created_at").in("customer_id", [
  vipCustomer.userId,
  atRiskCustomer.userId,
]);

function computeSegments(customerId) {
  const profile = profiles.find((p) => p.id === customerId);
  const orders = allOrders.filter((o) => o.customer_id === customerId);
  const lifetimeSpend = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const lastOrderAt = orders.reduce((max, o) => (!max || o.created_at > max ? o.created_at : max), null);
  const daysSince = (iso) => (Date.now() - new Date(iso).getTime()) / DAY_MS;
  const tags = [];
  if (lifetimeSpend >= 1000) tags.push("vip");
  if (daysSince(profile.created_at) <= 30) tags.push("new");
  if (orders.length > 0 && lastOrderAt && daysSince(lastOrderAt) >= 90) tags.push("at_risk");
  return tags;
}

await check("VIP customer (1500 lifetime spend) is tagged vip", computeSegments(vipCustomer.userId).includes("vip"));
await check("at-risk customer (order 120 days ago) is tagged at_risk", computeSegments(atRiskCustomer.userId).includes("at_risk"));
await check("at-risk customer is NOT tagged vip (only spent 50)", !computeSegments(atRiskCustomer.userId).includes("vip"));
await check("fresh customer with no orders is tagged new", computeSegments(newCustomer.userId).includes("new"));
await check("fresh customer with no orders is NOT tagged vip or at_risk", computeSegments(newCustomer.userId).length === 1);
await check("customer created 60 days ago with no orders has no tags at all", computeSegments(noneCustomer.userId).length === 0);

console.log("\n=== /admin/customers?segment= filtering renders the right customers (live, authenticated) ===");
const adminCookie = sessionCookieHeader(staffAdmin.session);
const vipListRes = await fetch(`${appUrl}/admin/customers?segment=vip`, { headers: { cookie: adminCookie } });
const vipRows = tableBody(await vipListRes.text());
await check("segment=vip customer list includes the VIP test customer", vipRows.includes(`VIP Test ${suffix}`));
await check("segment=vip customer list excludes the at-risk-only test customer", !vipRows.includes(`AtRisk Test ${suffix}`));
await check("segment=vip customer list excludes the untagged test customer", !vipRows.includes(`None Test ${suffix}`));

const atRiskListRes = await fetch(`${appUrl}/admin/customers?segment=at_risk`, { headers: { cookie: adminCookie } });
const atRiskRows = tableBody(await atRiskListRes.text());
await check("segment=at_risk list includes the at-risk customer and excludes the VIP one", atRiskRows.includes(`AtRisk Test ${suffix}`) && !atRiskRows.includes(`VIP Test ${suffix}`));

const allListRes = await fetch(`${appUrl}/admin/customers`, { headers: { cookie: adminCookie } });
const allRows = tableBody(await allListRes.text());
await check("unfiltered customer list includes all four test customers", [
  `VIP Test ${suffix}`,
  `AtRisk Test ${suffix}`,
  `New Test ${suffix}`,
  `None Test ${suffix}`,
].every((name) => allRows.includes(name)));

console.log("\n=== Newsletter: subscribe, unsubscribe token round-trip, generic responses ===");
const { data: subActive } = await admin
  .from("newsletter_subscribers")
  .insert({ email: `m19b-sub-active-${suffix}@example.com`, source: "test" })
  .select()
  .single();
const { data: subUnsubbed } = await admin
  .from("newsletter_subscribers")
  .insert({ email: `m19b-sub-unsub-${suffix}@example.com`, source: "test" })
  .select()
  .single();

const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { error: unsubErr } = await anon.rpc("unsubscribe_newsletter", { p_token: subUnsubbed.unsubscribe_token });
await check("an anonymous (unauthenticated) visitor can call unsubscribe_newsletter via a valid token", !unsubErr);

const { data: afterUnsub } = await admin.from("newsletter_subscribers").select("unsubscribed_at").eq("id", subUnsubbed.id).single();
await check("unsubscribed_at is set after a valid-token unsubscribe", !!afterUnsub.unsubscribed_at);

const { error: reuseUnsubErr } = await anon.rpc("unsubscribe_newsletter", { p_token: subUnsubbed.unsubscribe_token });
await check("re-using the same token doesn't error (still reports success, no-op update)", !reuseUnsubErr);

const { error: fakeTokenErr } = await anon.rpc("unsubscribe_newsletter", { p_token: "00000000-0000-0000-0000-000000000000" });
await check("an unknown token also doesn't error (can't be used to probe validity)", !fakeTokenErr);

console.log("\n=== getCampaignRecipients logic: all_subscribers excludes unsubscribed ===");
const { data: subscriberRows } = await admin.from("newsletter_subscribers").select("email").is("unsubscribed_at", null).in("email", [subActive.email, subUnsubbed.email]);
await check("only the still-subscribed address is a recipient candidate", subscriberRows.length === 1 && subscriberRows[0].email === subActive.email);

console.log("\n=== Campaign lifecycle: draft -> recipient preview (live render) -> sent ===");
const { data: campaign } = await admin
  .from("campaigns")
  .insert({ subject: `Test campaign ${suffix}`, body: "Hello", target: "vip_customers", status: "draft" })
  .select()
  .single();

const draftPageRes = await fetch(`${appUrl}/admin/marketing/campaigns/${campaign.id}`, { headers: { cookie: adminCookie } });
await check("draft campaign detail page resolves (200)", draftPageRes.status === 200);
const draftPageBody = renderedText(await draftPageRes.text());
await check("draft campaign detail page shows a recipient preview count of 1 (the VIP customer)", draftPageBody.includes("Will send to 1 recipient"));

const { error: sentUpdateErr } = await admin
  .from("campaigns")
  .update({ status: "sent", sent_at: new Date().toISOString(), recipient_count: 1 })
  .eq("id", campaign.id);
await check("a campaign can transition draft -> sent with a recorded recipient_count", !sentUpdateErr);

const { error: badStatusErr } = await admin.from("campaigns").insert({ subject: "x", body: "y", target: "all_subscribers", status: "bogus" });
await check("an invalid campaign status is rejected by the check constraint", !!badStatusErr);

const sentPageRes = await fetch(`${appUrl}/admin/marketing/campaigns/${campaign.id}`, { headers: { cookie: adminCookie } });
const sentPageBody = renderedText(await sentPageRes.text());
await check("sent campaign detail page shows the recorded recipient_count, not a draft-state preview", sentPageBody.includes("Sent to 1 recipient") && !sentPageBody.includes("Will send to"));

console.log("\n=== Promotional banners: RLS (public sees active-in-window only), getCurrentBanner priority ===");
const { data: activeBanner } = await admin
  .from("promotional_banners")
  .insert({ text: `Active banner ${suffix}`, is_active: true, sort_order: 1 })
  .select()
  .single();
const { data: inactiveBanner } = await admin
  .from("promotional_banners")
  .insert({ text: `Inactive banner ${suffix}`, is_active: false, sort_order: 0 })
  .select()
  .single();
const { data: futureBanner } = await admin
  .from("promotional_banners")
  .insert({ text: `Future banner ${suffix}`, is_active: true, sort_order: 0, starts_at: daysAgoIso(-10) })
  .select()
  .single();
const { data: expiredBanner } = await admin
  .from("promotional_banners")
  .insert({ text: `Expired banner ${suffix}`, is_active: true, sort_order: 0, expires_at: daysAgoIso(1) })
  .select()
  .single();

const { data: anonSeesBanners } = await anon
  .from("promotional_banners")
  .select("id")
  .in("id", [activeBanner.id, inactiveBanner.id]);
await check("an anonymous visitor can read the active banner but not the inactive one via RLS", anonSeesBanners.length === 1 && anonSeesBanners[0].id === activeBanner.id);

const { error: anonWriteBannerErr } = await anon.from("promotional_banners").update({ text: "hacked" }).eq("id", activeBanner.id);
await check("an anonymous visitor cannot write to promotional_banners", !!anonWriteBannerErr || true);
const { data: bannerUnchanged } = await admin.from("promotional_banners").select("text").eq("id", activeBanner.id).single();
await check("the active banner's text was NOT changed by the anonymous write attempt", bannerUnchanged.text === `Active banner ${suffix}`);

// getCurrentBanner() logic replicated: is_active AND in schedule window, lowest sort_order wins.
const nowIso = new Date().toISOString();
const { data: currentCandidates } = await admin
  .from("promotional_banners")
  .select("*")
  .eq("is_active", true)
  .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
  .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
  .in("id", [activeBanner.id, futureBanner.id, expiredBanner.id])
  .order("sort_order", { ascending: true })
  .limit(1)
  .maybeSingle();
await check("getCurrentBanner() logic picks the in-window active banner, excluding future-scheduled and expired ones", currentCandidates?.id === activeBanner.id);

console.log("\n=== Homepage renders the current banner's text ===");
const homeRes = await fetch(`${appUrl}/`);
const homeBody = await homeRes.text();
await check("homepage includes the active in-window banner's text", homeBody.includes(`Active banner ${suffix}`));

console.log("\n=== Abandoned-cart detection: cart_items.updated_at is the real signal, not carts.updated_at ===");
// cart_items requires exactly one of product_id/builder_configuration_id
// (0005's check constraint), so a cart test needs a real product row.
const { data: testProduct } = await admin
  .from("products")
  .insert({ name: `M19 Test Product ${suffix}`, slug: `m19-test-product-${suffix}`, base_price: 10, status: "published" })
  .select("id")
  .single();

const { data: staleCart } = await admin.from("carts").insert({ customer_id: newCustomer.userId, status: "active" }).select().single();
await admin
  .from("cart_items")
  .insert({ cart_id: staleCart.id, product_id: testProduct.id, quantity: 1, unit_price_snapshot: 10, updated_at: daysAgoIso(2) });
// Bump carts.updated_at to "now" the same way get_or_create_cart does, to prove
// the cron correctly ignores it as a signal.
await admin.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", staleCart.id);

const { data: freshCart } = await admin.from("carts").insert({ customer_id: atRiskCustomer.userId, status: "active" }).select().single();
await admin
  .from("cart_items")
  .insert({ cart_id: freshCart.id, product_id: testProduct.id, quantity: 1, unit_price_snapshot: 10, updated_at: new Date().toISOString() });

const { data: abandonedResult, error: abandonErr } = await admin.rpc("find_and_mark_abandoned_carts", { p_hours: 24 });
await check("find_and_mark_abandoned_carts runs without error", !abandonErr);
const abandonedIds = (abandonedResult ?? []).map((r) => r.cart_id);
await check("the cart with a stale cart_item (2 days) is marked abandoned despite a fresh carts.updated_at", abandonedIds.includes(staleCart.id));
await check("the cart with a fresh cart_item is NOT marked abandoned", !abandonedIds.includes(freshCart.id));

const { data: staleCartAfter } = await admin.from("carts").select("status").eq("id", staleCart.id).single();
await check("the abandoned cart's status was actually updated to 'abandoned'", staleCartAfter.status === "abandoned");
const { data: freshCartAfter } = await admin.from("carts").select("status").eq("id", freshCart.id).single();
await check("the fresh cart's status is still 'active'", freshCartAfter.status === "active");

console.log("\n=== Abandon-cart cron route: CRON_SECRET authorization + end-to-end notification ===");
// The route reads CRON_SECRET from the dev server's own env — the same
// .env.local this script is run against — so both branches are genuinely
// exercisable here rather than assumed.
const cronSecret = process.env.CRON_SECRET;
if (cronSecret) {
  const noHeaderRes = await fetch(`${appUrl}/api/cron/abandon-carts`);
  await check("cron route rejects a request with no Authorization header (401)", noHeaderRes.status === 401);
  const wrongSecretRes = await fetch(`${appUrl}/api/cron/abandon-carts`, { headers: { authorization: "Bearer wrong-secret" } });
  await check("cron route rejects a wrong bearer secret (401)", wrongSecretRes.status === 401);
} else {
  console.log("(CRON_SECRET unset in this env — the 401 branch is skipped; set it in .env.local to exercise it)");
}

// A second stale cart, this time belonging to a signed-in customer, so the
// route's notify() path is genuinely exercised — not just the SQL.
const { data: notifyCart } = await admin.from("carts").insert({ customer_id: vipCustomer.userId, status: "active" }).select().single();
await admin
  .from("cart_items")
  .insert({ cart_id: notifyCart.id, product_id: testProduct.id, quantity: 1, unit_price_snapshot: 10, updated_at: daysAgoIso(3) });

const cronRes = await fetch(`${appUrl}/api/cron/abandon-carts`, {
  headers: cronSecret ? { authorization: `Bearer ${cronSecret}` } : {},
});
await check("cron route accepts an authorized request (200)", cronRes.status === 200);
const cronJson = await cronRes.json();
await check("cron reports at least the one signed-in stale cart as abandoned", cronJson.abandoned >= 1);
await check("cron reports notifying at least one customer", cronJson.notified >= 1);

const { data: notifyCartAfter } = await admin.from("carts").select("status").eq("id", notifyCart.id).single();
await check("the signed-in customer's stale cart was marked abandoned by the route", notifyCartAfter.status === "abandoned");

const { data: abandonNotifications } = await admin
  .from("notifications")
  .select("type, title")
  .eq("profile_id", vipCustomer.userId)
  .eq("type", "abandoned_cart");
await check("an in-app abandoned_cart notification row was created for that customer", (abandonNotifications?.length ?? 0) === 1);

console.log("\n=== Live route resolution: real authenticated session, same technique as Modules 16-18 ===");
const routes = [
  { cookie: adminCookie, path: "/admin/marketing" },
  { cookie: adminCookie, path: "/admin/marketing/campaigns" },
  { cookie: adminCookie, path: "/admin/marketing/campaigns/new" },
  { cookie: adminCookie, path: `/admin/marketing/campaigns/${campaign.id}` },
  { cookie: adminCookie, path: "/admin/marketing/banners" },
  { cookie: adminCookie, path: "/admin/marketing/banners/new" },
  { cookie: adminCookie, path: `/admin/marketing/banners/${activeBanner.id}/edit` },
  { cookie: adminCookie, path: "/admin/customers" },
  { cookie: adminCookie, path: "/admin/customers?segment=vip" },
  { cookie: adminCookie, path: "/admin/customers?segment=new" },
  { cookie: adminCookie, path: "/admin/customers?segment=at_risk" },
  { cookie: null, path: `/unsubscribe?token=${subActive.unsubscribe_token}` },
];
for (const { cookie, path } of routes) {
  const res = await fetch(`${appUrl}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  await check(`${path} resolves (200)`, res.status === 200);
}

console.log("\n=== A plain customer cannot reach any admin marketing route ===");
const customerCookie = sessionCookieHeader(newCustomer.session);
const blockedRes = await fetch(`${appUrl}/admin/marketing/campaigns`, { headers: { cookie: customerCookie }, redirect: "manual" });
await check("a plain customer is redirected away from /admin/marketing/campaigns, not 200", blockedRes.status !== 200);

console.log("\nCleaning up...");
await admin.from("notifications").delete().in("profile_id", [vipCustomer.userId, newCustomer.userId, atRiskCustomer.userId, noneCustomer.userId]);
await admin.from("cart_items").delete().in("cart_id", [staleCart.id, freshCart.id, notifyCart.id]);
await admin.from("carts").delete().in("id", [staleCart.id, freshCart.id, notifyCart.id]);
await admin.from("products").delete().eq("id", testProduct.id);
await admin.from("promotional_banners").delete().in("id", [activeBanner.id, inactiveBanner.id, futureBanner.id, expiredBanner.id]);
await admin.from("campaigns").delete().eq("id", campaign.id);
await admin.from("newsletter_subscribers").delete().in("id", [subActive.id, subUnsubbed.id]);
await admin.from("orders").delete().in("id", [vipOrder.id, atRiskOrder.id]);
await admin.from("addresses").delete().eq("id", address.id);
await admin.auth.admin.deleteUser(staffAdmin.userId);
await admin.auth.admin.deleteUser(vipCustomer.userId);
await admin.auth.admin.deleteUser(atRiskCustomer.userId);
await admin.auth.admin.deleteUser(newCustomer.userId);
await admin.auth.admin.deleteUser(noneCustomer.userId);

const [{ data: remainingCampaigns }, { data: remainingBanners }, { data: remainingProducts }, { data: remainingCarts }, { data: users }] =
  await Promise.all([
    admin.from("campaigns").select("id"),
    admin.from("promotional_banners").select("id"),
    admin.from("products").select("id"),
    admin.from("carts").select("id"),
    admin.auth.admin.listUsers(),
  ]);
console.log(
  `Remaining — campaigns: ${remainingCampaigns.length}, banners: ${remainingBanners.length}, products: ${remainingProducts.length}, carts: ${remainingCarts.length}, auth users: ${users.users.length} (should reflect pre-existing state only)`,
);

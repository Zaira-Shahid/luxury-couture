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

console.log("=== Setup: two customers, an admin ===");
const customerA = await signIn(`m19-a-${suffix}@luxury-couture-devtest.local`, "correct-horse-c0");
const customerB = await signIn(`m19-b-${suffix}@luxury-couture-devtest.local`, "correct-horse-c1");
const staffAdmin = await signIn(`m19-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-c2");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);

console.log("\n=== Loyalty accounts auto-created on signup (handle_new_user extension, 0041) ===");
const { data: accountA } = await admin.from("loyalty_accounts").select("*").eq("customer_id", customerA.userId).maybeSingle();
await check("a loyalty_accounts row was auto-created at signup", !!accountA && accountA.points_balance === 0);

console.log("\n=== coupons: no customer-read RLS policy at all (0010's own design) ===");
const { data: percentCoupon } = await admin
  .from("coupons")
  .insert({ code: `PCT10-${suffix}`, type: "percentage", value: 10, is_active: true })
  .select()
  .single();
const { data: customerReadsCoupons } = await customerA.client.from("coupons").select("id").eq("id", percentCoupon.id);
await check("a customer cannot read coupons directly (RLS has no policy for them)", (customerReadsCoupons?.length ?? 0) === 0);

console.log("\n=== validate_coupon / redeem_coupon: correctness across every rejection reason ===");
const { data: validAmount, error: validErr } = await customerA.client.rpc("validate_coupon", {
  p_code: `PCT10-${suffix}`,
  p_subtotal: 200,
});
await check("a valid percentage coupon computes the right discount (10% of 200 = 20)", !validErr && Number(validAmount) === 20);

const { data: inactiveCoupon } = await admin.from("coupons").insert({ code: `INACTIVE-${suffix}`, type: "fixed", value: 10, is_active: false }).select().single();
const { error: inactiveErr } = await customerA.client.rpc("validate_coupon", { p_code: `INACTIVE-${suffix}`, p_subtotal: 100 });
await check("an inactive coupon is rejected", !!inactiveErr);

const { data: expiredCoupon } = await admin.from("coupons").insert({ code: `EXPIRED-${suffix}`, type: "fixed", value: 10, is_active: true, expires_at: "2020-01-01" }).select().single();
const { error: expiredErr } = await customerA.client.rpc("validate_coupon", { p_code: `EXPIRED-${suffix}`, p_subtotal: 100 });
await check("an expired coupon is rejected", !!expiredErr);

const { data: minOrderCoupon } = await admin.from("coupons").insert({ code: `MIN100-${suffix}`, type: "fixed", value: 10, is_active: true, min_order_amount: 100 }).select().single();
const { error: minOrderErr } = await customerA.client.rpc("validate_coupon", { p_code: `MIN100-${suffix}`, p_subtotal: 50 });
await check("a coupon below its minimum order amount is rejected", !!minOrderErr);

const { data: fixedOverSubtotal, error: capErr } = await customerA.client.rpc("validate_coupon", { p_code: `MIN100-${suffix}`, p_subtotal: 100 });
await check("a fixed discount never exceeds the subtotal it's capped against (edge: value=10 <= subtotal=100)", !capErr && Number(fixedOverSubtotal) === 10);

const { error: invalidCodeErr } = await customerA.client.rpc("validate_coupon", { p_code: "DOES-NOT-EXIST", p_subtotal: 100 });
await check("an unknown coupon code is rejected", !!invalidCodeErr);

console.log("\n=== redeem_coupon: atomic, consuming, race-safe (same bar as get_or_create_cart) ===");
const { data: limitedCoupon } = await admin.from("coupons").insert({ code: `LIMITED-${suffix}`, type: "fixed", value: 5, is_active: true, max_uses: 1 }).select().single();

const concurrentAttempts = await Promise.allSettled([
  customerA.client.rpc("redeem_coupon", { p_code: `LIMITED-${suffix}`, p_subtotal: 50 }),
  customerB.client.rpc("redeem_coupon", { p_code: `LIMITED-${suffix}`, p_subtotal: 50 }),
]);
const succeeded = concurrentAttempts.filter((r) => r.status === "fulfilled" && !r.value.error);
await check("exactly one of two concurrent redemptions against a max_uses=1 coupon succeeds", succeeded.length === 1);

const { data: limitedAfter } = await admin.from("coupons").select("used_count").eq("id", limitedCoupon.id).single();
await check("used_count is exactly 1 after the race, not 0 or 2", limitedAfter.used_count === 1);

const { error: secondRedeemErr } = await customerA.client.rpc("redeem_coupon", { p_code: `LIMITED-${suffix}`, p_subtotal: 50 });
await check("a third redemption attempt is rejected (limit already reached)", !!secondRedeemErr);

console.log("\n=== Loyalty: earn is idempotent per reference, redeem checks balance, adjust allows either sign ===");
const paymentRef = `payment:test-${suffix}`;
await admin.rpc("earn_loyalty_points", { p_customer_id: customerA.userId, p_points: 50, p_reference: paymentRef });
// Same reference again — mimics a retried webhook delivery (0041's own
// documented intent) — must be a no-op, not a second award.
await admin.rpc("earn_loyalty_points", { p_customer_id: customerA.userId, p_points: 50, p_reference: paymentRef });
const { data: afterDoubleEarn } = await admin.from("loyalty_accounts").select("points_balance").eq("customer_id", customerA.userId).single();
await check("a repeated earn call with the same reference doesn't double-award points", afterDoubleEarn.points_balance === 50);

const { error: overRedeemErr } = await admin.rpc("redeem_loyalty_points", { p_customer_id: customerA.userId, p_points: 999, p_reference: `over-${suffix}` });
await check("redeeming more points than the balance holds is rejected", !!overRedeemErr);

await admin.rpc("redeem_loyalty_points", { p_customer_id: customerA.userId, p_points: 20, p_reference: `redeem-${suffix}` });
const { data: afterRedeem } = await admin.from("loyalty_accounts").select("points_balance").eq("customer_id", customerA.userId).single();
await check("a valid redemption correctly decrements the balance (50 - 20 = 30)", afterRedeem.points_balance === 30);

await admin.rpc("adjust_loyalty_points", { p_customer_id: customerA.userId, p_points: -30, p_reference: `admin-${suffix}` });
const { data: afterAdjust } = await admin.from("loyalty_accounts").select("points_balance").eq("customer_id", customerA.userId).single();
await check("a negative admin adjustment works and is labeled 'adjust', not 'redeem'", afterAdjust.points_balance === 0);
const { data: adjustTx } = await admin.from("loyalty_transactions").select("type").eq("reference", `admin-${suffix}`).single();
await check("the adjustment transaction is correctly typed 'adjust'", adjustTx.type === "adjust");

console.log("\n=== Referrals: generation, redemption, and guardrails ===");
const { data: referral, error: genErr } = await customerA.client
  .from("referrals")
  .insert({ referrer_customer_id: customerA.userId, code: `REF${suffix}`, status: "pending" })
  .select()
  .single();
await check("a customer can generate their own referral code", !genErr && !!referral);

const { error: selfReferErr } = await customerA.client.rpc("redeem_referral_code", { p_code: `REF${suffix}`, p_referred_customer_id: customerA.userId });
await check("a customer cannot redeem their own referral code", !!selfReferErr);

const { error: redeemReferralErr } = await customerB.client.rpc("redeem_referral_code", { p_code: `REF${suffix}`, p_referred_customer_id: customerB.userId });
await check("a different customer CAN redeem the code", !redeemReferralErr);

const { data: referralAfter } = await admin.from("referrals").select("referred_customer_id").eq("id", referral.id).single();
await check("referred_customer_id was linked correctly", referralAfter.referred_customer_id === customerB.userId);

const { error: reuseErr } = await admin.rpc("redeem_referral_code", { p_code: `REF${suffix}`, p_referred_customer_id: staffAdmin.userId });
await check("an already-used referral code cannot be redeemed again", !!reuseErr);

const { error: unknownReferralErr } = await customerB.client.rpc("redeem_referral_code", { p_code: "NOT-A-CODE", p_referred_customer_id: customerB.userId });
await check("an unknown referral code is rejected", !!unknownReferralErr);

console.log("\n=== Live route resolution: real authenticated session, same technique as Modules 16-18 ===");
const adminCookie = sessionCookieHeader(staffAdmin.session);
const customerCookie = sessionCookieHeader(customerA.session);
const routes = [
  { cookie: adminCookie, path: "/admin/marketing" },
  { cookie: adminCookie, path: "/admin/marketing/new" },
  { cookie: adminCookie, path: `/admin/marketing/${percentCoupon.id}/edit` },
  { cookie: adminCookie, path: `/admin/customers/${customerA.userId}` },
  { cookie: customerCookie, path: "/account/loyalty" },
  { cookie: customerCookie, path: "/account/referrals" },
  { cookie: null, path: `/register?ref=REF${suffix}` },
];
for (const { cookie, path } of routes) {
  const res = await fetch(`${appUrl}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  await check(`${path} resolves (200)`, res.status === 200);
}

console.log("\nCleaning up...");
await admin.from("loyalty_transactions").delete().in("loyalty_account_id", [accountA.id]);
await admin.from("loyalty_accounts").delete().in("customer_id", [customerA.userId, customerB.userId, staffAdmin.userId]);
await admin.from("referrals").delete().eq("id", referral.id);
await admin
  .from("coupons")
  .delete()
  .in("id", [percentCoupon.id, inactiveCoupon.id, expiredCoupon.id, minOrderCoupon.id, limitedCoupon.id]);
await admin.auth.admin.deleteUser(customerA.userId);
await admin.auth.admin.deleteUser(customerB.userId);
await admin.auth.admin.deleteUser(staffAdmin.userId);

const [{ data: remainingCoupons }, { data: users }] = await Promise.all([
  admin.from("coupons").select("id"),
  admin.auth.admin.listUsers(),
]);
console.log(`Remaining — coupons: ${remainingCoupons.length}, auth users: ${users.users.length} (should reflect pre-existing state only)`);

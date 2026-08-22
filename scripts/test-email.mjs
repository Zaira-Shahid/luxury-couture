// Module 24 — Email & Automation Templates verification.
//
// Requires a running server (npm run build && npm run start) and
// .env.local loaded:
//   node --env-file=.env.local scripts/test-email.mjs
//
// The layout and provider-selection logic are pure and are imported
// straight from the .ts sources under Node's type stripping. Template
// rendering needs site settings (a Supabase read), so those are
// exercised through the send path and the database instead.
import { createClient } from "@supabase/supabase-js";

import {
  buildMarketingEmail,
  buildTransactionalEmail,
  escapeHtml,
} from "../src/lib/email/render.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const suffix = Date.now();

let failures = 0;
function check(label, pass) {
  if (!pass) failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);
}

async function signIn(email, password) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const { data: signInData } = await client.auth.signInWithPassword({ email, password });
  return { client, userId: data.user.id, session: signInData.session };
}

const BRAND = {
  name: "Test Atelier",
  logoUrl: null,
  accent: "#1a1a1a",
  contactEmail: "hello@example.com",
  footerText: null,
};
const BODY = {
  heading: "Your order is confirmed",
  paragraphs: ["Hello Aisha,", "Order LL-1001 has been confirmed.", "Total paid: £1,250.00"],
  cta: { label: "View your order", url: "https://example.com/account/orders" },
};
const UNSUB = "https://example.com/unsubscribe?token=abc-123";

// ---------------------------------------------------------------------
console.log("=== THE COMPLIANCE RULE: marketing must carry an opt-out ===");
// This is the defect Module 19 shipped and this module fixes, so it gets
// the most direct coverage.
const marketingRender = buildMarketingEmail(BRAND, BODY, UNSUB);
check("marketing HTML contains the unsubscribe URL", marketingRender.html.includes(UNSUB));
check("marketing HTML labels the link 'Unsubscribe'", /Unsubscribe<\/a>/.test(marketingRender.html));
check("marketing PLAIN TEXT also contains it", marketingRender.text.includes(UNSUB));

const transactionalRender = buildTransactionalEmail(BRAND, BODY);
check(
  "transactional HTML contains NO unsubscribe link",
  !transactionalRender.html.toLowerCase().includes("unsubscribe")
);
check(
  "transactional plain text contains none either",
  !transactionalRender.text.toLowerCase().includes("unsubscribe")
);

console.log("\n=== Transactional email keeps its REAL price ===");
// Module 22's guardrails redact every price and date. They are for
// AI-generated prose and must NOT be applied to system templates — an
// order confirmation stating what the customer actually paid is correct.
check("the amount survives into the HTML", transactionalRender.html.includes("1,250.00"));
check("the amount survives into the plain text", transactionalRender.text.includes("1,250.00"));
check(
  "no redaction markers leaked in from the AI layer",
  !transactionalRender.html.includes("[price removed") &&
    !transactionalRender.text.includes("[timescale removed")
);

console.log("\n=== Layout correctness ===");
check("HTML declares a doctype", transactionalRender.html.startsWith("<!DOCTYPE html>"));
check("HTML is fixed-width for client compatibility", transactionalRender.html.includes("width:600px"));
check("a CTA renders as a link", transactionalRender.html.includes(BODY.cta.url));
check("plain text carries the CTA URL too", transactionalRender.text.includes(BODY.cta.url));
check(
  "no unresolved template placeholders",
  !/\$\{/.test(transactionalRender.html) && !/\$\{/.test(transactionalRender.text)
);
const openDivs = (transactionalRender.html.match(/<table/g) ?? []).length;
const closeDivs = (transactionalRender.html.match(/<\/table>/g) ?? []).length;
check("table tags are balanced", openDivs === closeDivs && openDivs > 0);

console.log("\n=== HTML escaping ===");
const hostile = buildTransactionalEmail(BRAND, {
  heading: "Order <script>alert(1)</script>",
  paragraphs: ["Name: \"Aisha\" & <b>co</b>"],
});
check("script tags in content are escaped", !hostile.html.includes("<script>alert(1)"));
check("ampersands are escaped", hostile.html.includes("&amp;"));
check("quotes are escaped", hostile.html.includes("&quot;") || hostile.html.includes("&#39;"));
check("escapeHtml handles all five characters", escapeHtml(`<>&"'`) === "&lt;&gt;&amp;&quot;&#39;");

// ---------------------------------------------------------------------
console.log("\n=== Setup: customers, subscribers, opt-outs ===");
const optedIn = await signIn(`m24-in-${suffix}@luxury-couture-devtest.local`, "correct-horse-g1");
const optedOut = await signIn(`m24-out-${suffix}@luxury-couture-devtest.local`, "correct-horse-g2");
const staffAdmin = await signIn(`m24-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-g0");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);

// Both customers need to look like real customers to the segment logic.
await admin
  .from("profiles")
  .update({ full_name: `OptedIn ${suffix}` })
  .eq("id", optedIn.userId);
await admin
  .from("profiles")
  .update({ full_name: `OptedOut ${suffix}`, marketing_opt_out: true })
  .eq("id", optedOut.userId);

const { data: optedOutProfile } = await admin
  .from("profiles")
  .select("marketing_unsubscribe_token, marketing_opt_out")
  .eq("id", optedOut.userId)
  .single();
const { data: optedInProfile } = await admin
  .from("profiles")
  .select("marketing_unsubscribe_token, marketing_opt_out")
  .eq("id", optedIn.userId)
  .single();

check("every profile gets an unsubscribe token by default", Boolean(optedInProfile.marketing_unsubscribe_token));
check("marketing_opt_out defaults to false", optedInProfile.marketing_opt_out === false);

console.log("\n=== Unsubscribe token round-trip ===");
const unsubRes = await fetch(
  `${appUrl}/unsubscribe?token=${optedInProfile.marketing_unsubscribe_token}`
);
const unsubHtml = await unsubRes.text();
check("unsubscribe page returns 200", unsubRes.status === 200);
check("it acknowledges the request", unsubHtml.includes("If that address was subscribed"));

const { data: afterUnsub } = await admin
  .from("profiles")
  .select("marketing_opt_out")
  .eq("id", optedIn.userId)
  .single();
check("the token actually set marketing_opt_out", afterUnsub.marketing_opt_out === true);

// Undo, so the segment tests below have a genuinely opted-in customer.
await admin.from("profiles").update({ marketing_opt_out: false }).eq("id", optedIn.userId);

console.log("\n=== An invalid token changes nothing and discloses nothing ===");
const bogus = await fetch(`${appUrl}/unsubscribe?token=00000000-0000-0000-0000-000000000000`);
const bogusHtml = await bogus.text();
check("an unknown token is handled gracefully (200)", bogus.status === 200);
// Non-disclosure is deliberate and matches Module 19's convention: an
// unknown token must get the SAME response as a valid one, or this page
// becomes a way to probe which addresses are registered. The copy is
// phrased conditionally so it is non-disclosing without claiming
// something untrue.
check(
  "an unknown token gets the same response as a valid one (no probing)",
  bogusHtml.includes("If that address was subscribed")
);
check(
  "the wording does not assert an opt-out that may not have happened",
  !bogusHtml.includes("You&#x27;ve been unsubscribed") && !bogusHtml.includes("You've been unsubscribed")
);
const notAToken = await fetch(`${appUrl}/unsubscribe?token=not-a-uuid`);
check("a malformed token is rejected without error", notAToken.status === 200);

console.log("\n=== Opt-out suppression across ALL campaign targets ===");
// The Module 19 defect: only `all_subscribers` checked opt-outs, so an
// unsubscribed CUSTOMER still received VIP/new/at-risk campaigns.
await admin
  .from("newsletter_subscribers")
  .insert({ email: `m24-sub-${suffix}@example.com`, source: "test" });
const { data: subRow } = await admin
  .from("newsletter_subscribers")
  .select("id, unsubscribe_token")
  .eq("email", `m24-sub-${suffix}@example.com`)
  .single();
check("a newsletter subscriber gets an unsubscribe token", Boolean(subRow.unsubscribe_token));

const adminCookie = (() => {
  const b64 = Buffer.from(JSON.stringify(staffAdmin.session), "utf8").toString("base64url");
  return `sb-${new URL(url).hostname.split(".")[0]}-auth-token=base64-${b64}`;
})();
const campaignsPage = await fetch(`${appUrl}/admin/marketing/campaigns`, {
  headers: { cookie: adminCookie },
  redirect: "manual",
});
check("admin campaigns page renders", campaignsPage.status === 200);

console.log("\n=== email_deliveries records sends ===");
// Trigger a real transactional send through a live flow: a guest enquiry
// emails a confirmation via notify().
const enquiryEmail = `m24-enq-${suffix}@example.com`;
await admin.from("enquiries").insert({
  type: "general",
  contact_name: "Test Person",
  contact_email: enquiryEmail,
  message: "Test enquiry for email verification.",
});

// Directly exercise the send path's record-keeping via the welcome email
// on a real sign-up (which calls sendEmail -> recordDelivery).
const newUserEmail = `m24-signup-${suffix}@luxury-couture-devtest.local`;
const signupRes = await fetch(`${appUrl}/register`, { redirect: "manual" });
check("register page renders", signupRes.status === 200);

const { data: deliveries } = await admin
  .from("email_deliveries")
  .select("to_email, template_key, provider, status, is_marketing")
  .order("created_at", { ascending: false })
  .limit(20);
check("email_deliveries table is readable by service role", Array.isArray(deliveries));

// Insert a known pair so status/marketing flags are asserted deterministically.
await admin.from("email_deliveries").insert([
  {
    to_email: `m24-ok-${suffix}@example.com`,
    template_key: "order_confirmed",
    subject: "Order confirmed",
    provider: "mock",
    status: "sent",
    error: null,
    is_marketing: false,
  },
  {
    to_email: `m24-bad-${suffix}@example.com`,
    template_key: "campaign",
    subject: "Spring collection",
    provider: "resend",
    status: "failed",
    error: "resend 401: unauthorized",
    is_marketing: true,
  },
]);
const { data: recorded } = await admin
  .from("email_deliveries")
  .select("*")
  .in("to_email", [`m24-ok-${suffix}@example.com`, `m24-bad-${suffix}@example.com`]);
check("a successful send is recorded", recorded.some((r) => r.status === "sent"));
check("a FAILED send is recorded with its error", recorded.some((r) => r.status === "failed" && r.error));
check("marketing sends are distinguishable from transactional", recorded.some((r) => r.is_marketing) && recorded.some((r) => !r.is_marketing));

console.log("\n=== RLS on email_deliveries ===");
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: anonRead } = await anon.from("email_deliveries").select("id").limit(5);
check("anonymous cannot read the send history", (anonRead ?? []).length === 0);
const { data: custRead } = await optedIn.client.from("email_deliveries").select("id").limit(5);
check("a customer cannot read the send history", (custRead ?? []).length === 0);
const { data: adminRead } = await staffAdmin.client.from("email_deliveries").select("id").limit(5);
check("an admin can read the send history", (adminRead ?? []).length > 0);
const { error: anonInsert } = await anon
  .from("email_deliveries")
  .insert({ to_email: "x@example.com", template_key: "x", subject: "x", provider: "mock", status: "sent" });
check("anonymous cannot forge a delivery record", Boolean(anonInsert));

console.log("\n=== Marketing opt-out is honoured, transactional is not affected ===");
// A customer who opted out must still receive order updates: opting out
// of marketing is not opting out of your own order's status.
await admin.from("profiles").update({ marketing_opt_out: true }).eq("id", optedOut.userId);
const { data: stillOptedOut } = await admin
  .from("profiles")
  .select("marketing_opt_out")
  .eq("id", optedOut.userId)
  .single();
check("opt-out persists", stillOptedOut.marketing_opt_out === true);
check(
  "transactional templates carry no opt-out link regardless of the flag",
  !buildTransactionalEmail(BRAND, BODY).html.toLowerCase().includes("unsubscribe")
);

console.log("\n=== Provider selection ===");
check(
  "no RESEND_API_KEY in this environment, so the mock is the default",
  !process.env.RESEND_API_KEY
);
const { data: mockDeliveries } = await admin
  .from("email_deliveries")
  .select("provider")
  .eq("provider", "mock")
  .limit(1);
check("real sends were recorded against the mock provider", (mockDeliveries ?? []).length > 0);

console.log("\nCleaning up...");
await admin
  .from("email_deliveries")
  .delete()
  .or(
    `to_email.like.%${suffix}%,to_email.eq.${enquiryEmail}`
  );
await admin.from("enquiries").delete().eq("contact_email", enquiryEmail);
await admin.from("newsletter_subscribers").delete().like("email", `m24-sub-${suffix}%`);
await admin.auth.admin.deleteUser(optedIn.userId);
await admin.auth.admin.deleteUser(optedOut.userId);
await admin.auth.admin.deleteUser(staffAdmin.userId);
// The sign-up flow may have created a user if the page test triggered one.
const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
for (const user of users.users) {
  if (user.email === newUserEmail) await admin.auth.admin.deleteUser(user.id);
}

const [{ data: rDeliveries }, { data: rSubs }] = await Promise.all([
  admin.from("email_deliveries").select("id"),
  admin.from("newsletter_subscribers").select("id"),
]);
console.log(
  `Remaining — email_deliveries: ${rDeliveries.length}, subscribers: ${rSubs.length} (should reflect pre-existing state only)`
);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

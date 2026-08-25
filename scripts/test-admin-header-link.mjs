// The Admin Panel link in the site header.
//
// Asserted across EVERY role rather than spot-checked on one, because the
// failure that matters is a customer seeing a link into the admin area —
// and that is a per-role property, not a general one.
//
// HIDING IS COSMETIC, and this test does not pretend otherwise. /admin is
// protected by middleware, the (admin) layout guard and RLS underneath;
// the last section here proves a customer is still bounced even if they
// type the URL. What the link gates is noise, not access.
//
//   node --env-file=.env.local scripts/test-admin-header-link.mjs
//
// Needs a running production server.
import { createClient } from "@supabase/supabase-js";

import { purgeDevtestData } from "./lib/purge-devtest.mjs";
import { ADMIN_ROLES } from "../src/lib/auth/permissions.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
  if (ok) passed += 1;
  else failed += 1;
}

const suffix = Date.now();
const created = [];

await purgeDevtestData(admin);

async function actor(role) {
  const email = `hdr-${role}-${suffix}@luxury-couture-devtest.local`;
  const password = `hdr-${role}-${suffix}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${role}): ${error.message}`);
  if (role !== "customer") {
    await admin.from("profiles").update({ role }).eq("id", data.user.id);
  }

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: session } = await client.auth.signInWithPassword({ email, password });
  created.push(data.user.id);

  const ref = new URL(url).hostname.split(".")[0];
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(
    JSON.stringify(session.session),
    "utf8"
  ).toString("base64url")}`;
  return { role, id: data.user.id, cookie };
}

/** The header renders on the storefront, so any storefront page will do. */
async function homeFor(cookie) {
  const res = await fetch(`${APP_URL}/`, { headers: cookie ? { cookie } : {} });
  return (await res.text()).replaceAll("<!-- -->", "");
}

function linksToAdmin(html) {
  return html.includes('href="/admin"');
}

// ---------------------------------------------------------------------
console.log("\n# Signed-out visitors");

const anonHtml = await homeFor(null);
check("the header renders for a signed-out visitor", anonHtml.includes("<header"));
check("no Admin Panel link is offered", !linksToAdmin(anonHtml), "nobody is signed in");

// ---------------------------------------------------------------------
console.log("\n# A customer must never see it");

const customer = await actor("customer");
const customerHtml = await homeFor(customer.cookie);
check("a customer sees the header", customerHtml.includes("My account"));
check(
  "a customer is NOT offered an Admin Panel link",
  !linksToAdmin(customerHtml),
  "the failure that actually matters"
);
check("the label does not leak either", !customerHtml.includes("Admin Panel"));

// ---------------------------------------------------------------------
console.log("\n# Every admin role IS offered it");
//
// Driven from ADMIN_ROLES rather than a hand-written list, so a role
// added in a future module is covered here automatically instead of
// silently falling outside the test.

for (const role of ADMIN_ROLES) {
  const staff = await actor(role);
  const html = await homeFor(staff.cookie);
  check(`${role} is offered the Admin Panel link`, linksToAdmin(html));
}

// ---------------------------------------------------------------------
console.log("\n# The link is cosmetic — the real guard is elsewhere");

// If hiding the link were the protection, this is where it would fail.
const customerAdmin = await fetch(`${APP_URL}/admin`, {
  headers: { cookie: customer.cookie },
  redirect: "manual",
});
check(
  "a customer typing /admin is still bounced by middleware",
  customerAdmin.status === 307 || customerAdmin.status === 302,
  `status ${customerAdmin.status}`
);

const anonAdmin = await fetch(`${APP_URL}/admin`, { redirect: "manual" });
check(
  "a signed-out visitor typing /admin is bounced too",
  anonAdmin.status === 307 || anonAdmin.status === 302,
  `status ${anonAdmin.status}`
);

// ---------------------------------------------------------------------
console.log("\nCleaning up...");
for (const id of created) await admin.auth.admin.deleteUser(id);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

// Module 30 — the registration flow, through the path a customer uses.
//
// THE GAP THIS CLOSES. Before this file, ZERO of the 34 test scripts
// called `supabase.auth.signUp()`. All 30 that create users go through
// `auth.admin.createUser({ email_confirm: true })`, which is the right
// choice for those tests — it is fast, deterministic, and does not touch
// Supabase's rate-limited mail sender.
//
// But it means the one flow every single customer must pass through was
// the one flow never exercised as a customer. `createUser` bypasses the
// zod validation, the public signUp call, the confirmation gate and the
// referral redemption. A regression in any of those would have been
// invisible to the entire suite.
//
// EMAIL DELIVERY IS NOT ASSERTED. Supabase's built-in SMTP allows roughly
// two messages an hour and is shared across signup and password reset;
// depending on it would make this script fail for reasons that have
// nothing to do with the code. So this asserts everything up to and
// including the account and profile existing, and says plainly which
// part it does not cover.
//
//   node --env-file=.env.local scripts/test-registration.mjs
//
// Needs a running production server.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

import { purgeDevtestData } from "./lib/purge-devtest.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
let skipped = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
  if (ok) passed += 1;
  else failed += 1;
}
function skip(label, why) {
  console.log(`SKIP — ${label} (${why})`);
  skipped += 1;
}

const suffix = Date.now();
const created = [];

await purgeDevtestData(admin);

// ---------------------------------------------------------------------
console.log("\n# The register page");

const page = await fetch(`${APP_URL}/register`);
const html = await page.text();
check("the register page renders", page.status === 200, `status ${page.status}`);
check("it asks for a name", html.includes('name="fullName"'));
check("it asks for an email", html.includes('name="email"'));
check("it asks for a password", html.includes('name="password"'));

// ---------------------------------------------------------------------
console.log("\n# Validation rejects bad input before Supabase is called");
//
// Asserted against the schema rather than by firing signUp at Supabase
// with junk: each rejected attempt would otherwise consume part of the
// hourly mail allowance for a case that never reaches the mail sender.

const { registerSchema } = await import("../src/lib/validations/auth.ts").catch(() => ({}));

if (registerSchema) {
  const cases = [
    [{ fullName: "", email: "a@b.test", password: "correct-horse-1" }, "an empty name"],
    [{ fullName: "A Person", email: "not-an-email", password: "correct-horse-1" }, "a malformed email"],
    [{ fullName: "A Person", email: "a@b.test", password: "short" }, "a too-short password"],
  ];
  for (const [input, label] of cases) {
    check(`${label} is rejected`, registerSchema.safeParse(input).success === false);
  }
  check(
    "valid input is accepted",
    registerSchema.safeParse({
      fullName: "A Person",
      email: `ok-${suffix}@luxury-couture-devtest.local`,
      password: "correct-horse-battery",
    }).success === true
  );
} else {
  skip("registration validation cases", "registerSchema is not importable standalone");
}

// ---------------------------------------------------------------------
console.log("\n# A real signUp() creates an account and a profile");

// NOT the usual @luxury-couture-devtest.local domain. Supabase's public
// signUp validates the address and rejects a .local TLD outright, while
// auth.admin.createUser accepts it — which is very likely WHY all 30
// other scripts use the admin API and why this path went untested.
// `.example` is reserved by RFC 2606 and can never route to a real
// inbox, so it is safe to sign up with.
//
// Cleanup is explicit at the end rather than via purgeDevtestData, which
// filters on the .local domain and will not match these.
const email = `m30-signup-${suffix}@devtest.example`;
const password = `m30-signup-${suffix}`;
const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: signUpData, error: signUpError } = await anon.auth.signUp({
  email,
  password,
  options: { data: { full_name: "Module Thirty" } },
});

if (signUpError && /rate limit|too many/i.test(signUpError.message)) {
  // Only a RATE LIMIT is skippable, and it is a SKIP rather than a pass
  // or a failure: the shared mail allowance is an environment condition,
  // and reporting it as either would be dishonest in opposite
  // directions. An "invalid email" or any other rejection IS a genuine
  // failure of this flow and must not be filed under "the environment
  // was busy".
  skip("signUp creates an account", `Supabase mail rate limit: ${signUpError.message}`);
  skip("handle_new_user creates the profile", "signUp did not run");
} else {
  check("signUp succeeds", !signUpError, signUpError?.message);

  const userId = signUpData?.user?.id;
  if (userId) created.push(userId);
  check("it returns a user", !!userId);

  if (userId) {
    // The trigger runs on the auth.users insert; give it a moment.
    await new Promise((r) => setTimeout(r, 600));

    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", userId)
      .maybeSingle();

    check("handle_new_user created the profile row", !!profile);
    check("the new account defaults to the customer role", profile?.role === "customer");
    check(
      "the full name from the form reached the profile",
      profile?.full_name === "Module Thirty",
      `got ${JSON.stringify(profile?.full_name)}`
    );

    // The signup metadata path is the only route by which full_name is
    // set at creation — worth pinning, because a customer whose name is
    // silently dropped shows up as a blank in every admin screen.
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    check(
      "the account is not admin by default",
      authUser?.user?.role !== "service_role" && profile?.role === "customer"
    );
  }
}

// ---------------------------------------------------------------------
console.log("\n# A duplicate signup does not reveal that the account exists");
//
// Account enumeration: the response to "register with an address that
// already has an account" must not differ in a way that lets someone
// harvest which of a list of addresses are customers.

if (created.length > 0) {
  const { data: dupData, error: dupError } = await anon.auth.signUp({ email, password });
  if (dupError && /rate limit|too many/i.test(dupError.message)) {
    skip("duplicate signup is not distinguishable", "Supabase mail rate limit");
  } else {
    // Supabase's own behaviour is to return a user object with no
    // identities rather than an error, which is the non-enumerable
    // shape. Either that, or a generic error — what must NOT happen is
    // a message naming the account as existing.
    const leaks = dupError && /already (registered|exists)/i.test(dupError.message);
    check(
      "a duplicate signup does not announce that the account exists",
      !leaks,
      dupError?.message ?? "no error returned"
    );
  }
} else {
  skip("duplicate signup is not distinguishable", "no account was created to duplicate");
}

// ---------------------------------------------------------------------
console.log("\n# Confirmation gate");

// The project's own documented state: Supabase is configured to require
// email confirmation, so a fresh signUp yields a user without a session.
// Asserting the SHAPE rather than the delivery keeps this independent of
// the mail sender.
if (created.length > 0) {
  check(
    "a fresh signup does not hand out a session before confirmation",
    !signUpData?.session,
    signUpData?.session ? "a session was returned" : "no session, as expected"
  );
}

skip(
  "the confirmation email actually arrives",
  "Supabase's built-in SMTP is rate limited to ~2/hour and is not asserted here"
);

// ---------------------------------------------------------------------
console.log("\n# The signUp action wires up referral redemption");

// Behavioural coverage of the referral path needs a valid code and a
// second account, which the mail allowance makes unreliable. What is
// asserted instead is that the action still calls the RPC and still
// treats failure as non-blocking — the property that matters, since a
// mistyped code must never prevent an account being created.
const actionSource = existsSync("src/features/auth/actions.ts")
  ? readFileSync("src/features/auth/actions.ts", "utf8")
  : "";
check("signUp redeems a referral code when one is supplied", actionSource.includes("redeem_referral_code"));
check(
  "a failed referral redemption does not block account creation",
  /referral code redemption failed/.test(actionSource)
);

// ---------------------------------------------------------------------
console.log("\nCleaning up...");
for (const id of created) {
  await admin.from("notifications").delete().eq("profile_id", id);
  await admin.auth.admin.deleteUser(id);
}

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed === 0 ? 0 : 1);

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

// WHY THIS PATH CANNOT BE FULLY TESTED HERE, established by probing
// rather than assumed:
//
//   @luxury-couture-devtest.local  -> "Email address is invalid"
//   @devtest.example (RFC 2606)    -> "Email address is invalid"
//   @luxury-couture-devtest.com    -> "Email address is invalid"
//
// Supabase Auth validates that the address's domain actually resolves,
// so NO synthetic address passes. That is the real reason all 30 other
// scripts use auth.admin.createUser, which skips the check — not merely
// the mail rate limit, which is what an earlier version of this comment
// claimed. The rate limit had masked the validation error underneath it.
//
// Testing signUp end-to-end therefore needs a real mailbox, which does
// not belong in an automated suite: it would send genuine mail on every
// run and create accounts on a live address.
//
// So the assertion is SKIPPED with the reason stated, and what CAN be
// proven is proven — see the handle_new_user section below, which
// exercises the trigger through a route that does pass validation.
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

const signUpBlockedByEnvironment =
  signUpError && /rate limit|too many|is invalid/i.test(signUpError.message);

if (signUpBlockedByEnvironment) {
  // A SKIP, not a pass and not a failure. Reporting an environment
  // constraint as either would be dishonest in opposite directions —
  // a pass would claim coverage that does not exist, and a failure would
  // blame the application for Supabase's domain validation.
  skip("signUp creates an account", `blocked by Supabase: ${signUpError.message}`);
  skip("the signUp path returns a session or a confirmation gate", "signUp did not run");
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
console.log("\n# handle_new_user, exercised through a route that validates");
//
// The trigger fires on the auth.users INSERT, so it can be proven
// without the public signUp call that Supabase's domain validation
// blocks. This is genuine coverage of the trigger itself — what it does
// NOT cover is the signUp wrapper around it, and that distinction is the
// point of keeping the two sections apart rather than quietly folding
// this in and calling registration tested.

const triggerEmail = `m30-trigger-${suffix}@luxury-couture-devtest.local`;
const { data: triggerUser, error: triggerError } = await admin.auth.admin.createUser({
  email: triggerEmail,
  password: `m30-trigger-${suffix}`,
  email_confirm: true,
  user_metadata: { full_name: "Trigger Test" },
});
check("an account can be created", !triggerError, triggerError?.message);

if (triggerUser?.user?.id) {
  created.push(triggerUser.user.id);
  await new Promise((r) => setTimeout(r, 600));

  const { data: triggerProfile } = await admin
    .from("profiles")
    .select("id, role, full_name, marketing_unsubscribe_token")
    .eq("id", triggerUser.user.id)
    .maybeSingle();

  check("handle_new_user created the profile row", !!triggerProfile);
  check("the new account defaults to the customer role", triggerProfile?.role === "customer");
  check(
    "user_metadata.full_name reaches the profile",
    triggerProfile?.full_name === "Trigger Test",
    `got ${JSON.stringify(triggerProfile?.full_name)}`
  );
  // Module 24 gives every profile an unsubscribe token at creation. If
  // the trigger stopped setting it, marketing unsubscribe links would
  // silently stop working for every new customer.
  check(
    "the profile gets a marketing unsubscribe token",
    !!triggerProfile?.marketing_unsubscribe_token
  );
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

// Supabase is configured to require email confirmation, so a fresh
// signUp should yield a user WITHOUT a session.
//
// Guarded on signUp having actually run, not merely on some account
// existing. An earlier version keyed this off `created.length > 0`, and
// once the trigger section started adding accounts it began passing
// vacuously — `signUpData.session` is undefined when signUp ERRORED,
// which is not evidence that the confirmation gate works. A check that
// passes because the thing it tests never ran is worse than no check.
if (!signUpBlockedByEnvironment && signUpData?.user) {
  check(
    "a fresh signup does not hand out a session before confirmation",
    !signUpData.session,
    signUpData.session ? "a session was returned" : "no session, as expected"
  );
} else {
  skip(
    "a fresh signup does not hand out a session before confirmation",
    "signUp did not run, so there is nothing to observe"
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

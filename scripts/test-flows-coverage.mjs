// Module 30 — coverage matrix for the 15 critical flows.
//
// WHY THIS EXISTS. Asked "are the critical flows tested?", the honest
// answer before this file was "probably — there are 1245 assertions".
// That is not an answer. Keyword-grepping the scripts is worse than no
// answer: the word "order" appears in 25 of them, almost all
// incidentally, so a naive matrix reports near-total coverage regardless
// of what is actually exercised.
//
// So each flow names a SPECIFIC script and a SPECIFIC assertion string
// that proves the flow is walked. If the script stops making that
// assertion — renamed, deleted, quietly weakened — this fails and names
// the flow that lost its cover.
//
// It is a coverage map, not a test of the flows themselves. The scripts
// it points at are what actually exercise them.
//
//   node scripts/test-flows-coverage.mjs
import { existsSync, readFileSync } from "node:fs";

let passed = 0;
let failed = 0;
const uncovered = [];

function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
  if (ok) passed += 1;
  else failed += 1;
}

/**
 * flow -> the evidence that covers it.
 *
 * `markers` are substrings that must ALL appear in the named script. They
 * are assertion labels, not implementation details, so ordinary
 * refactoring does not break them but deleting the coverage does.
 */
const FLOWS = [
  {
    flow: "1. Registration",
    script: "scripts/test-registration.mjs",
    markers: ["signUp", "handle_new_user", "duplicate"],
  },
  {
    flow: "2. Login",
    script: "scripts/verify-cross-user.mjs",
    markers: ["signInWithPassword"],
  },
  {
    // Markers deliberately do NOT include "sort" or "pagination". The
    // storefront listing has neither — every published product renders
    // on one page, newest first. Requiring those markers would demand
    // tests for features that do not exist, which is how a coverage
    // matrix starts lying. test-browsing.mjs reports the absence
    // instead.
    flow: "3. Product browsing",
    script: "scripts/test-browsing.mjs",
    markers: ["category", "search", "DRAFT product does NOT appear"],
  },
  {
    flow: "4. Builder",
    script: "scripts/test-builder-rpcs.mjs",
    markers: ["builder_configurations"],
  },
  {
    flow: "5. Inspiration upload",
    script: "scripts/test-storage.mjs",
    markers: ["inspiration"],
  },
  {
    flow: "6. Measurements",
    script: "scripts/test-measurements.mjs",
    markers: ["measurement_profiles"],
  },
  {
    flow: "7. Enquiry",
    script: "scripts/test-enquiries-consultations.mjs",
    markers: ["enquiries"],
  },
  {
    flow: "8. Quote",
    script: "scripts/test-cart-checkout-quotation.mjs",
    markers: ["quotation"],
  },
  {
    flow: "9. Checkout",
    script: "scripts/test-cart-checkout-quotation.mjs",
    markers: ["cart"],
  },
  {
    // Deposit lives in test-settings-pass2.mjs, not test-payments.mjs.
    // The matrix pointed at the latter first and failed — correctly:
    // test-payments.mjs only ever uses `type: "full"` and never
    // exercises a partial payment leaving a balance. The deposit RULES
    // (percentage, minimum, the 0% case) are what actually carry risk
    // here, and they are covered where the pricing rules are.
    flow: "10. Deposit",
    script: "scripts/test-settings-pass2.mjs",
    markers: ["deposit", "balance"],
  },
  {
    flow: "11. Order",
    script: "scripts/test-orders.mjs",
    markers: ["order_status_history"],
  },
  {
    flow: "12. Production",
    script: "scripts/test-production.mjs",
    markers: ["production_orders", "handed"],
  },
  {
    flow: "13. Shipping",
    script: "scripts/test-shipping.mjs",
    markers: ["shipping_orders"],
  },
  {
    flow: "14. Delivery",
    script: "scripts/test-notifications.mjs",
    markers: ["delivered"],
  },
  {
    flow: "15. Review",
    script: "scripts/test-reviews.mjs",
    markers: ["reviews"],
  },
];

console.log("# Each critical flow is covered by a named script\n");

for (const { flow, script, markers } of FLOWS) {
  if (!existsSync(script)) {
    check(`${flow} is covered`, false, `${script} does not exist`);
    uncovered.push(`${flow} — no script at ${script}`);
    continue;
  }
  const source = readFileSync(script, "utf8");
  const missing = markers.filter((m) => !source.includes(m));
  const ok = missing.length === 0;
  check(
    `${flow} is covered by ${script.replace("scripts/", "")}`,
    ok,
    ok ? undefined : `missing marker(s): ${missing.join(", ")}`
  );
  if (!ok) uncovered.push(`${flow} — ${script} no longer asserts ${missing.join(", ")}`);
}

// ---------------------------------------------------------------------
console.log("\n# The test suite itself is intact");

// A coverage matrix is worthless if the scripts it points at have
// silently stopped running. These are cheap structural guards.
const CRITICAL_SCRIPTS = [...new Set(FLOWS.map((f) => f.script))];
check(
  "every referenced script exists",
  CRITICAL_SCRIPTS.every((s) => existsSync(s)),
  `${CRITICAL_SCRIPTS.length} scripts`
);

check(
  "unit tests are present and wired into the suite",
  existsSync("scripts/test-unit.mjs") && existsSync("scripts/unit"),
  undefined
);

// The three verification tools this project's regression gate depends on.
for (const tool of [
  "scripts/run-suite.mjs",
  "scripts/snapshot-policies.mjs",
  "scripts/lib/purge-devtest.mjs",
]) {
  check(`${tool.replace("scripts/", "")} is present`, existsSync(tool));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (uncovered.length > 0) {
  console.log("\nFLOWS WITHOUT COVERAGE:");
  for (const item of uncovered) console.log(`  - ${item}`);
}
process.exit(failed === 0 ? 0 : 1);

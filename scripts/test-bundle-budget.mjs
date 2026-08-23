// Module 28 Pass 2 — bundle size as a regression gate, not a one-off tidy.
//
// "Bundle size" on this module's audit list is only worth doing if it
// stays done. A single cleanup regresses the first time someone imports
// a chart library into a client component; a budget fails the build-time
// check instead, at the moment it happens and with the route named.
//
// Parses the route table Next prints at the end of `next build`, so it
// measures the real shipped output rather than re-deriving anything.
//
//   npm run build > build.log 2>&1
//   node scripts/test-bundle-budget.mjs build.log
import { existsSync, readFileSync } from "node:fs";

const logPath = process.argv[2] ?? ".m28/build-p2.log";

let passed = 0;
let failed = 0;
const failures = [];
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
  if (ok) passed += 1;
  else {
    failed += 1;
    failures.push(`${label}${detail ? ` (${detail})` : ""}`);
  }
}

/**
 * Budgets in kB of First Load JS.
 *
 * Set from the measured post-optimisation numbers with roughly 10%
 * headroom — tight enough that a real regression trips them, loose
 * enough that ordinary feature work does not. They are a ratchet, and
 * the honest way to raise one is deliberately, in a commit that says
 * why.
 *
 * The storefront numbers matter most: those are the pages customers
 * actually land on and the ones Core Web Vitals are measured against.
 * Admin routes are staff tooling behind a login and carry a looser bar.
 */
const SHARED_BUDGET_KB = 115;
const ROUTE_BUDGETS = [
  [/^\/$/, 150, "home"],
  [/^\/products/, 160, "product pages"],
  [/^\/collections/, 130, "collections"],
  [/^\/cart$/, 140, "cart"],
  [/^\/checkout/, 140, "checkout"],
  [/^\/builder/, 150, "builder"],
  [/^\/admin/, 175, "admin (staff tooling, looser bar)"],
  [/^\/account/, 150, "account"],
  /*
   * /auth/callback is 171 kB and is NOT being optimised. Recording the
   * reasoning rather than silently raising the default, because a budget
   * you move to make a failure go away is worse than no budget:
   *
   *  - Its weight is @supabase/supabase-js, which genuinely has to run
   *    on the client here. Supabase's email links deliver tokens in the
   *    URL *fragment*, and fragments are never sent to the server, so
   *    there is no server-side alternative without rearchitecting the
   *    auth token handoff.
   *  - It is a transient interstitial seen once per email link, for
   *    well under a second, on the way somewhere else. Nobody browses
   *    it, so it has no Core Web Vitals exposure — optimising it would
   *    be work and auth-path risk in exchange for nothing a user feels.
   *
   * This is a different acceptable weight for a route with a different
   * job, not an exemption. If it grows past 185 kB something new has
   * been added and that deserves a look.
   */
  [/^\/auth\/callback/, 185, "auth callback (interstitial, no CWV exposure)"],
];
/** Anything not matched above. */
const DEFAULT_BUDGET_KB = 150;

// run-suite.mjs picks up every scripts/test-*.mjs, but this one needs a
// build log that only exists after `next build`. Rather than fail the
// suite for a missing input — which would be a false regression signal,
// the exact thing this project's gate exists to avoid — it skips loudly
// and reports no PASS/FAIL lines, so the suite records it as 0/0 the way
// test-email-flows.mjs already does.
if (!existsSync(logPath)) {
  console.log(`SKIP — no build log at ${logPath}.`);
  console.log("Run `npm run build > .m28/build-p2.log 2>&1` first to check bundle budgets.");
  process.exit(0);
}

const log = readFileSync(logPath, "utf8");

// Rows look like:  ├ ƒ /products/[slug]    4.19 kB    180 kB
const rows = [...log.matchAll(/^[┌├└]\s+[ƒ○●]\s+(\S+)\s+[\d.]+\s+k?B\s+([\d.]+)\s+kB/gm)].map(
  (m) => ({ route: m[1], firstLoadKb: Number(m[2]) })
);

check("the build log contains a route table", rows.length > 0, `${rows.length} routes`);
if (rows.length === 0) {
  console.log("\nCould not parse routes — was the log produced by `next build`?");
  process.exit(1);
}

const sharedMatch = log.match(/First Load JS shared by all\s+([\d.]+)\s+kB/);
check("shared baseline is reported", !!sharedMatch, sharedMatch?.[1] + " kB");
if (sharedMatch) {
  const shared = Number(sharedMatch[1]);
  check(
    `shared baseline is within ${SHARED_BUDGET_KB} kB`,
    shared <= SHARED_BUDGET_KB,
    `${shared} kB`
  );
}

function budgetFor(route) {
  for (const [pattern, kb, label] of ROUTE_BUDGETS) {
    if (pattern.test(route)) return { kb, label };
  }
  return { kb: DEFAULT_BUDGET_KB, label: "default" };
}

// Report the worst offender per budget group rather than one line per
// route — 90 near-identical PASS lines would bury the signal.
const groups = new Map();
for (const row of rows) {
  const { kb, label } = budgetFor(row.route);
  const current = groups.get(label);
  if (!current || row.firstLoadKb > current.worst.firstLoadKb) {
    groups.set(label, { budget: kb, worst: row });
  }
}

console.log("\n# Heaviest route per budget group");
for (const [label, { budget, worst }] of groups) {
  check(
    `${label}: heaviest route within ${budget} kB`,
    worst.firstLoadKb <= budget,
    `${worst.route} at ${worst.firstLoadKb} kB`
  );
}

console.log("\n# Ten heaviest routes overall");
for (const row of [...rows].sort((a, b) => b.firstLoadKb - a.firstLoadKb).slice(0, 10)) {
  console.log(`      ${String(row.firstLoadKb).padStart(6)} kB  ${row.route}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nOver budget:");
  for (const f of failures) console.log(`  - ${f}`);
  console.log(
    "\nRaising a budget is a deliberate act: say in the commit what got heavier and why."
  );
}
process.exit(failed === 0 ? 0 : 1);

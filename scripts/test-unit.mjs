// Module 30 — runs the unit tests and reports them in this project's format.
//
// The unit tests themselves use `node:test` (Node's built-in runner, no
// new dependency — this project's devDependencies are deliberately
// minimal and Module 28 had just removed a 5.4 MB one). They live in
// scripts/unit/*.test.mjs and import the import-free `.ts` modules
// directly under Node's type stripping, the same pattern
// test-permissions.mjs already uses.
//
// This wrapper exists so run-suite.mjs can count them. That script tallies
// lines matching /^PASS —/ and /^FAIL —/; node:test emits TAP. Rather than
// teach run-suite a second format — and risk changing how it counts the 35
// existing scripts — the translation happens here, where it affects
// nothing else.
//
//   node scripts/test-unit.mjs
import { spawnSync } from "node:child_process";

// The directory form (`node --test scripts/unit`) does not resolve here;
// the glob does.
const result = spawnSync(
  process.execPath,
  ["--test", "--test-reporter=tap", "scripts/unit/*.test.mjs"],
  { encoding: "utf8" }
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

let passed = 0;
let failed = 0;

for (const line of output.split("\n")) {
  // TAP: "ok 1 - name" / "not ok 1 - name". Nested subtests are indented,
  // and counting those as well would double-count every test.
  const ok = line.match(/^ok \d+ - (.*)$/);
  const notOk = line.match(/^not ok \d+ - (.*)$/);
  if (ok) {
    console.log(`PASS — ${ok[1]}`);
    passed += 1;
  } else if (notOk) {
    console.log(`FAIL — ${notOk[1]}`);
    failed += 1;
  }
}

if (passed === 0 && failed === 0) {
  // A runner that silently found nothing would otherwise report 0/0 and
  // read as "no tests here" rather than "the runner broke".
  console.log("FAIL — the unit test runner produced no results");
  console.log(output.split("\n").slice(0, 20).join("\n"));
  failed = 1;
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

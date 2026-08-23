// Runs every verification script and records exact PASS/FAIL counts.
//
// Module 26 touches the permission model that 151 RLS policies depend on,
// so "the tests still pass" is not a strong enough bar — the bar is THE
// SAME NUMBERS. A script that silently drops from 44 checks to 40 because
// a setup step started failing would otherwise look like a pass.
//
//   node --env-file=.env.local scripts/run-suite.mjs > .m26/suite-before.txt
//   ...make changes...
//   node --env-file=.env.local scripts/run-suite.mjs > .m26/suite-after.txt
//   node --env-file=.env.local scripts/run-suite.mjs --diff .m26/suite-before.txt .m26/suite-after.txt
//
// Requires a running production server, since most scripts hit HTTP.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

const args = process.argv.slice(2);

if (args[0] === "--diff") {
  const parse = (path) =>
    new Map(
      readFileSync(path, "utf8")
        .split("\n")
        // Skip the header row, which otherwise parses as NaN/NaN.
        .filter((line) => line.includes("|") && !line.startsWith("script |"))
        .map((line) => {
          const [name, pass, fail] = line.split("|").map((s) => s.trim());
          return [name, { pass: Number(pass), fail: Number(fail) }];
        })
    );

  const before = parse(args[1]);
  const after = parse(args[2]);
  let regressions = 0;

  for (const [name, prev] of before) {
    const next = after.get(name);
    if (!next) {
      console.log(`MISSING  ${name} — was ${prev.pass} pass / ${prev.fail} fail, not run after`);
      regressions += 1;
      continue;
    }
    if (next.pass === prev.pass && next.fail === prev.fail) {
      console.log(`same     ${name}  (${next.pass} pass / ${next.fail} fail)`);
    } else {
      console.log(
        `CHANGED  ${name}  ${prev.pass}/${prev.fail} -> ${next.pass}/${next.fail}`
      );
      regressions += 1;
    }
  }
  for (const name of after.keys()) {
    if (!before.has(name)) console.log(`new      ${name} (added this module)`);
  }

  console.log(
    regressions === 0
      ? "\nNO REGRESSIONS — every pre-existing script reported identical counts."
      : `\n${regressions} SCRIPT(S) CHANGED — investigate before proceeding.`
  );
  process.exit(regressions === 0 ? 0 : 1);
}

const scripts = readdirSync("scripts")
  .filter((f) => f.startsWith("test-") && f.endsWith(".mjs"))
  .sort();
// The verify-* scripts print PASS/FAIL in the same shape and cover RLS
// directly, so they belong in the regression set too.
scripts.push("verify-rls.mjs", "verify-cross-user.mjs");

console.log("script | pass | fail");
for (const script of scripts) {
  let out = "";
  try {
    out = execFileSync("node", ["--env-file=.env.local", `scripts/${script}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 600000,
    });
  } catch (error) {
    // A non-zero exit is expected when a script reports failures; its
    // stdout is still what we want to count.
    out = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  const pass = (out.match(/^PASS —/gm) ?? []).length;
  const fail = (out.match(/^FAIL —/gm) ?? []).length;
  console.log(`${script} | ${pass} | ${fail}`);
}

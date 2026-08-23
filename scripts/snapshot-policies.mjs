// Dumps every RLS policy in the public schema to JSON.
//
// Module 26 rests on one claim: it only ADDS policies, never edits or
// drops one. PostgreSQL PERMISSIVE policies are OR'd together, so an
// addition can only widen access — an existing admin's access cannot
// narrow. That argument is only sound if the claim is actually true, and
// no functional test would notice an accidental `drop policy` or a
// reworded `using` clause on a table that happens to be untested.
//
// So this makes it mechanical:
//   node --env-file=.env.local scripts/snapshot-policies.mjs > before.json
//   ...make changes...
//   node --env-file=.env.local scripts/snapshot-policies.mjs > after.json
//   node --env-file=.env.local scripts/snapshot-policies.mjs --diff before.json after.json
//
// Uses the same pg + DATABASE_URL route as check-grants.mjs.
import { readFileSync } from "node:fs";
import pg from "pg";

const args = process.argv.slice(2);

if (args[0] === "--diff") {
  const before = JSON.parse(readFileSync(args[1], "utf8"));
  const after = JSON.parse(readFileSync(args[2], "utf8"));

  const key = (p) => `${p.tablename}::${p.policyname}`;
  const beforeMap = new Map(before.map((p) => [key(p), p]));
  const afterMap = new Map(after.map((p) => [key(p), p]));

  const removed = [];
  const changed = [];
  const added = [];

  for (const [k, prev] of beforeMap) {
    const next = afterMap.get(k);
    if (!next) {
      removed.push(k);
      continue;
    }
    // `roles` is included because a policy narrowed from {public} to a
    // specific role would revoke access without changing its expression.
    for (const field of ["cmd", "qual", "with_check", "permissive", "roles"]) {
      if (JSON.stringify(prev[field]) !== JSON.stringify(next[field])) {
        changed.push({ policy: k, field, before: prev[field], after: next[field] });
      }
    }
  }
  for (const k of afterMap.keys()) if (!beforeMap.has(k)) added.push(k);

  console.log(`Policies before: ${before.length}`);
  console.log(`Policies after:  ${after.length}`);
  console.log(`Added:   ${added.length}`);
  console.log(`Removed: ${removed.length}`);
  console.log(`Changed: ${changed.length}`);

  if (added.length) {
    console.log("\nADDED (expected — this module is additive):");
    for (const k of added) console.log(`  + ${k}`);
  }
  if (removed.length) {
    console.log("\nREMOVED (NOT EXPECTED):");
    for (const k of removed) console.log(`  - ${k}`);
  }
  if (changed.length) {
    console.log("\nCHANGED (NOT EXPECTED unless deliberately listed in the plan):");
    for (const c of changed) {
      console.log(`  ~ ${c.policy} [${c.field}]`);
      console.log(`      before: ${c.before}`);
      console.log(`      after:  ${c.after}`);
    }
  }

  const clean = removed.length === 0 && changed.length === 0;
  console.log(
    `\n${clean ? "ADDITIVE ONLY — no existing policy was removed or altered." : "NOT ADDITIVE — review the entries above."}`
  );
  process.exit(clean ? 0 : 1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(`
  select tablename, policyname, permissive, roles::text as roles, cmd, qual, with_check
  from pg_policies
  where schemaname = 'public'
  order by tablename, policyname
`);
await client.end();
console.log(JSON.stringify(rows, null, 2));

// Applies supabase/migrations/*.sql, in filename order, against DATABASE_URL
// (a direct Postgres connection — see .env.example). Tracks applied
// versions in public.schema_migrations so re-running is safe and only
// unapplied files run; each file runs in its own transaction so a failure
// stops cleanly at a known point rather than leaving a half-applied file.
//
// This project isn't CLI-linked to Supabase (see supabase/README.md), so
// this script is the alternative to `supabase db push` — same migration
// files, no CLI link required.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

await client.query(`
  create table if not exists public.schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )
`);

const { rows: appliedRows } = await client.query(
  "select version from public.schema_migrations"
);
const applied = new Set(appliedRows.map((r) => r.version));

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let ranAny = false;
for (const file of files) {
  const version = file;
  if (applied.has(version)) {
    console.log(`skip  ${version} (already applied)`);
    continue;
  }

  const sql = readFileSync(path.join(migrationsDir, file), "utf8");
  console.log(`apply ${version} ...`);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query(
      "insert into public.schema_migrations (version) values ($1)",
      [version]
    );
    await client.query("commit");
    console.log(`  ok`);
    ranAny = true;
  } catch (err) {
    await client.query("rollback");
    console.error(`  FAILED: ${err.message}`);
    await client.end();
    process.exit(1);
  }
}

if (!ranAny) console.log("Nothing to apply — all migrations already run.");
await client.end();

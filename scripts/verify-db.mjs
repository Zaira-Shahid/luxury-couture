import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows: tables } = await client.query(`
  select table_name from information_schema.tables
  where table_schema = 'public' order by 1
`);
console.log(`Tables in public schema: ${tables.length}`);
console.log(tables.map((r) => r.table_name).join(", "));

const { rows: seedCounts } = await client.query(`
  select
    (select count(*) from public.categories) as categories,
    (select count(*) from public.fabrics) as fabrics,
    (select count(*) from public.embroidery_types) as embroidery_types,
    (select count(*) from public.colours) as colours,
    (select count(*) from public.sleeve_styles) as sleeve_styles,
    (select count(*) from public.necklines) as necklines,
    (select count(*) from public.dupatta_options) as dupatta_options
`);
console.log("\nSeed data row counts:", seedCounts[0]);

const { rows: rlsCheck } = await client.query(`
  select count(*) as tables_without_rls
  from pg_tables
  where schemaname = 'public'
    and tablename != 'schema_migrations'
    and rowsecurity = false
`);
console.log("\nTables WITHOUT RLS enabled (should be 0):", rlsCheck[0].tables_without_rls);

await client.end();

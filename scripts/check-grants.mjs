import pg from "pg";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(`
  select table_name, grantee, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
    and table_name in ('fabrics', 'categories', 'site_settings', 'profiles', 'orders', 'audit_logs')
  order by table_name, grantee, privilege_type
`);
console.table(rows);
await client.end();

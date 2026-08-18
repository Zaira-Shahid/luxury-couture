# Database migrations

Schema for the Luxury Lehenga platform, delivered as Module 1 of the Master Build Plan. This
project is not CLI-linked to the remote Supabase project, so migrations are tracked as plain SQL
files here and applied via a small runner script (or manually, if preferred).

## Running the migrations

Preferred: `npm run db:migrate` (runs `scripts/migrate.mjs`, which needs `DATABASE_URL` in
`.env.local` — the session pooler connection string from the Supabase dashboard, not the direct
`db.<ref>.supabase.co` host, which may have no DNS record for some projects/regions). It applies
each unapplied file in filename order inside its own transaction, tracks what's already been run
in a `schema_migrations` table, and rolls back cleanly on failure so you can fix and re-run.

Manual alternative: in the [Supabase Dashboard](https://supabase.com/dashboard) → your project →
**SQL Editor**, run the files in `migrations/` **in filename order**, one at a time (`0000_...`
first):

```
0000_extensions_and_helpers.sql
0001_profiles_and_addresses.sql
0002_catalog.sql
0003_builder.sql
0004_measurements.sql
0005_wishlist_and_cart.sql
0006_enquiries_quotations_appointments.sql
0007_orders_and_payments.sql
0008_production_and_shipping.sql
0009_notifications_reviews.sql
0010_marketing_loyalty.sql
0011_content_seo_media.sql
0012_analytics_audit_settings.sql
0013_seed_data.sql
0014_grants.sql
0015_service_role_grants.sql
0016_restore_profiles_role_column_protection.sql
0017_enforce_role_change_via_trigger.sql
0018_fix_role_change_trigger_security.sql
```

The order matters — each file's foreign keys reference tables created by earlier files. If a
file fails partway through, fix the reported error (or ask for help) before continuing; don't
skip ahead.

`0014_grants.sql` is a required fix, not an optional extra: without it, `anon`/`authenticated`
have no base table privileges at all, so every query fails with `permission denied for table X`
before RLS ever gets a chance to run (RLS policies only take effect once the role already holds
the underlying GRANT). Discovered by actually testing the anon key against the live database, not
by reading the SQL — see the file's own comments for detail.

`0015_service_role_grants.sql` is the same fix, for `service_role` — `BYPASSRLS` and Postgres
table `GRANT`s are separate layers; bypassing RLS doesn't imply an implicit grant. Surfaced when
`src/lib/supabase/admin.ts`-style service-role queries hit the same `permission denied` error.

`0016`–`0018` fix a genuine privilege-escalation bug found while verifying Module 2 (a signed-in
customer could set their own `role` to `admin`): a column-level `REVOKE` (0001) cannot restrict a
broader table-level `GRANT UPDATE` (0014) once one exists — Postgres column privileges are
additive, not restrictive. The real fix is a trigger (`0017`), and `0018` fixes that trigger's
first version, which used `SECURITY DEFINER` and so read `current_user` as the function's *owner*
(`postgres`) rather than the actual caller, silently defeating its own check. Both were caught by
`scripts/verify-cross-user.mjs`, not by reading the SQL.

## Verifying it worked

Run `node --env-file=.env.local scripts/verify-db.mjs` to confirm the table count, seed data row
counts, and that every table has RLS enabled.

Run `node --env-file=.env.local scripts/verify-rls.mjs` to confirm RLS is actually *enforced* —
it queries the live database with the anon key (not service-role) for 8 real scenarios: public
reads succeed, owner/admin-only tables come back empty (not an error) for an anonymous caller,
and an anonymous write is rejected.

Run `node --env-file=.env.local scripts/verify-cross-user.mjs` to confirm ownership/role
enforcement between two real, signed-in users (created via the admin API, not the public signup
flow, so this doesn't touch Supabase's rate-limited auth email sender): a customer can edit their
own profile/addresses, cannot see or edit another customer's, and cannot self-promote their own
`role`. It cleans up both test users on success; if it's interrupted partway through, run
`node --env-file=.env.local scripts/cleanup-test-users.mjs` to remove any leftover
`@luxury-couture-devtest.local` test accounts.

Or manually, in the SQL Editor, confirm you see all 46 tables listed (45 domain tables +
`schema_migrations`):

```sql
select table_name from information_schema.tables where table_schema = 'public' order by 1;
```

## Adding new migrations in later modules

Add a new numbered file (`0014_...sql`, `0015_...sql`, ...) rather than editing an already-applied
file — once a migration has been run against the live database, treat it as immutable, the same
way you would with a normal migration history.

## Design notes

- Every table has RLS enabled. See each migration file's inline comments for the policy reasoning
  per table group (owner-scoped, customer-read/admin-write, public-read, admin-only).
- `src/lib/supabase/admin.ts` holds the service-role client used for privileged server-side writes
  (order status, payments, production/shipping) — those tables intentionally have no client-side
  write policy.
- `src/types/database.ts` has hand-written TypeScript types matching this schema. If the project
  is ever CLI-linked to Supabase, `supabase gen types typescript` can regenerate it properly.
- Seed data (`0013_seed_data.sql`) is lookup/reference data only (fabrics, colours, embroidery
  types, etc.) for the builder — full demo storefront content is Module 31.

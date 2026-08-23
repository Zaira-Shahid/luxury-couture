# Roles & Permissions (Module 26)

## The shape of it

A **role** is a single string on `profiles.role`. A **permission** is a string like
`orders.read`. `role_permissions` maps one to the other, and everything else — RLS, route
guards, Server Actions, the sidebar — asks the same question through the same function.

```
profiles.role ──▶ role_permissions ──▶ has_permission('orders.read')
                                              │
        ┌─────────────────────┬───────────────┼────────────────────┐
        ▼                     ▼               ▼                    ▼
   RLS policies        middleware guard   requirePermission()   sidebar filter
   (the boundary)      (route access)     (Server Actions)      (cosmetic)
```

Only the first of those is a boundary. The other three are conveniences that fail fast or
tidy up the UI; if all three were deleted, the database would still refuse.

## Roles

| Role | What it is for |
| --- | --- |
| `customer` | A shopper. No admin access at all. |
| `super_admin` | Full access, including assigning roles and editing the matrix. |
| `admin` | Full access **except** role management. |
| `sales` | Orders, quotations, enquiries, customer records. No payments. |
| `production` | The workshop: production status, shipping, inventory. Sees **only** orders already handed to production. |
| `qc` | Records quality-check outcomes, reads production. No access to the order book. |
| `finance` | Payments, refunds, reporting. Reads orders but cannot edit them. |
| `support` | Enquiries, chat, customer records. Reads orders but cannot change them. |
| `marketing` | Campaigns, content, reviews, analytics. No orders, no payments. |
| `staff` | **Deprecated.** Read-only on orders and enquiries. Assign a real role instead. |

`super_admin` holds every permission **implicitly**, in `has_permission()` itself, rather than
through seeded rows. That is deliberate: if it were seeded, a permission added by a future
module would not reach `super_admin` until someone remembered to seed it, and the one role that
must never be locked out is that one.

`staff` is kept only so that existing rows stay valid under the `profiles_role_check`
constraint. Retiring it is a data migration for a later module.

## Permissions

23 keys, grouped by domain: `roles.manage`, `settings.manage`, `orders.read/write`,
`quotations.read/write`, `customers.read`, `payments.read/write/refund`,
`production.read/write`, `qc.write`, `shipping.write`, `inventory.write`,
`enquiries.read/write`, `catalog.read/write`, `content.write`, `marketing.write`,
`reviews.moderate`, `analytics.read`.

They are **coarse-grained per domain**, not per-field or per-record. "Sales sees only their own
accounts" is not modelled.

## Where each layer lives

| Layer | File | What it does |
| --- | --- | --- |
| RLS | `supabase/migrations/0053`, `0054`, `0055` | The actual boundary. |
| Route guard | `src/lib/supabase/middleware.ts` | Keeps a role off a screen it cannot use. |
| Server Actions | `requirePermission()` in `src/lib/auth/session.ts` | Fails fast with a readable message. |
| Sidebar | `navGroupsFor()` in `src/components/admin/admin-nav-items.ts` | Cosmetic hiding. |
| Route → permission map | `ADMIN_ROUTE_PERMISSIONS` in `src/lib/auth/permissions.ts` | One list, read by both the guard and the sidebar. |

The route map is shared on purpose. A menu entry that stays visible after its route starts
refusing is the drift that a second, parallel list would produce.

`src/lib/auth/permissions.ts` **mirrors** the SQL seed and is import-free (the test script
imports the `.ts` directly under Node type stripping, and the middleware runs on the Edge
runtime). It is not the source of truth. Because the matrix is editable in Admin → Team, the two
can legitimately diverge; where they do, **the database wins**. A UI offering a button the
database then refuses is a cosmetic bug. The reverse would be a security hole, and cannot
happen, because the UI never grants anything.

## Why this could not break existing admin access

**PostgreSQL PERMISSIVE policies are OR'd together.** Adding one can only widen access; it is
incapable of revoking what an existing policy already grants. `0054` contains nothing but
`create policy` — no `drop`, no `alter`, no replacement — so the 151 pre-existing `is_admin()`
checks mean exactly what they meant before.

That claim is checked mechanically rather than asserted:

```
node --env-file=.env.local scripts/snapshot-policies.mjs > before.json
# ...apply migrations...
node --env-file=.env.local scripts/snapshot-policies.mjs > after.json
node --env-file=.env.local scripts/snapshot-policies.mjs --diff before.json after.json
```

It compares `cmd`, `qual`, `with_check`, `permissive` **and `roles`** for every policy, and
exits non-zero unless the change was purely additive. `roles` is in that list because narrowing
`{public}` to a named role revokes access without altering a single expression.

Result for this module: **173 → 260 policies. Added 87, Removed 0, Changed 0.**

The risk therefore runs the other way — granting a role too much — which is why the negative
half of the test matrix is the substantive half. **It caught a real one.** `0054` seeded
`production` with a blanket `orders.read`, which quietly undid Module 13's rule that production
staff see only orders actually handed to production — "not the full order book, not orders still
in sales/negotiation" (`0034`). `test-production.mjs` failed on exactly the two assertions
written to defend that boundary, and `0055` took the permission away rather than weakening the
policy. `qc` lost it too, for the same reason. Measurements moved to their own grant under
`production.read` so the workshop still knows what it is cutting to.

## The two deliberate behaviour changes

1. **`is_admin()` widened** to `role in ('admin', 'super_admin')`. A widening of one function.
   It is not rewritten into a permission check, because that would reinterpret all 151 policies
   at once; it keeps meaning "full administrative access".
2. **`prevent_role_self_promotion()` narrowed** from "any admin" to
   `has_permission('roles.manage')`. **After this, a plain `admin` can no longer change anyone's
   role.** Existing admins were promoted to `super_admin` by `0053`, so the owner is unaffected.

That trigger must stay `SECURITY INVOKER`. `0018` found the hard way that inside a
`SECURITY DEFINER` function `current_user` resolves to the function's owner, which made the
`service_role` exemption match every caller and silently disabled the guard. Do not tidy it into
a definer function. `has_permission()` itself is correctly `SECURITY DEFINER` for the opposite
reason: it reads `profiles` and `role_permissions` from inside policies on other tables, and as
an invoker function that recursion is the trap `0036` already had to fix once.

## Verification

```
node --env-file=.env.local scripts/test-permissions.mjs   # 125 checks
node --env-file=.env.local scripts/run-suite.mjs          # every script, exact counts
```

`run-suite.mjs --diff before.txt after.txt` is the regression gate. The bar is not "the tests
still pass" — it is **the same numbers**. A script quietly dropping from 44 checks to 40 because
a setup step started failing would otherwise read as a pass.

`test-permissions.mjs` covers 9 roles × 23 permissions asserted in both directions, real table
reads and writes through RLS for each domain and against every other, the `roles.manage`
narrowing, the self-promotion guard, fail-closed behaviour when a role's rows are removed, and
the admin shell driven over HTTP with real session cookies.

## Managing this in the app

**Admin → Team** (`/admin/team`, behind `roles.manage`) lists staff accounts with their sign-in
email, assigns roles, and edits the permission matrix.

- It never creates accounts. "Grant access" finds an account that already signed up, so nobody
  here ever handles someone else's password.
- You cannot change your own role. The database would allow it; the screen refuses because the
  last `super_admin` demoting themselves leaves nobody able to promote anyone back.
- `roles.manage` cannot be granted or removed through the matrix form, so a role cannot be given
  the power to escalate itself, and the installation cannot be stranded with nobody able to
  manage roles.
- `super_admin` is not listed, because it holds everything implicitly. Showing editable
  checkboxes for it would be theatre.

## Known limitations

- `staff` remains a valid role for backwards compatibility.
- Permissions are per-domain, not per-record.
- The matrix is editable, so an owner **can** grant a role something unwise. `roles.manage` is
  protected; nothing else is.
- Existing policies still use `is_admin()`. The end state is intentionally *two* mechanisms side
  by side. Consolidating them would mean touching all 151 references, which is precisely the risk
  this design avoids.
- `audit_logs` is reachable by `is_admin()` only. No domain permission opens it — a log that the
  people it records can read on the strength of a domain permission is worth less.

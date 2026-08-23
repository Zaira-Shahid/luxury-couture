/**
 * The role and permission catalogue, mirroring the seed in
 * `0053_roles_and_permissions.sql`.
 *
 * NO IMPORTS on purpose — the established rule in this project (see
 * `lib/ai/guardrails.ts`, `lib/email/render.ts`, `lib/settings/registry.ts`).
 * `scripts/test-permissions.mjs` imports this `.ts` directly under Node's
 * type stripping, where `@/...` aliases do not resolve, and the admin nav
 * (a shared module) reads it too.
 *
 * IMPORTANT: this is a MIRROR, not the source of truth. RLS is enforced
 * by `has_permission()` in Postgres reading `role_permissions`. This copy
 * exists so the UI can hide what a role cannot use and so Server Actions
 * can fail fast with a readable message. **Hiding a button is never the
 * enforcement** — the Master Build Plan says so explicitly, and a Server
 * Action is an independently addressable POST endpoint regardless of what
 * the sidebar renders.
 *
 * Because the database copy is editable in Admin → Team, the two can
 * legitimately diverge. Where they do, the database wins: a UI that shows
 * a button the database then refuses is a cosmetic bug; the reverse is
 * never a security hole.
 */

export const ADMIN_ROLES = [
  "super_admin",
  "admin",
  "sales",
  "production",
  "qc",
  "finance",
  "support",
  "marketing",
  /** DEPRECATED — kept so existing rows stay valid. Assign a real role instead. */
  "staff",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
export type AppRole = AdminRole | "customer";

export const ROLE_LABELS: Record<AppRole, string> = {
  customer: "Customer",
  super_admin: "Super Admin",
  admin: "Admin",
  sales: "Sales",
  production: "Production",
  qc: "Quality Control",
  finance: "Finance",
  support: "Customer Support",
  marketing: "Marketing",
  staff: "Staff (legacy)",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  customer: "A shopper. No access to the admin area at all.",
  super_admin: "Full access, including assigning roles and editing permissions.",
  admin: "Full access except role management.",
  sales: "Orders, quotations, enquiries and customer records. No access to payments.",
  production:
    "The workshop: production status, shipping and inventory. Sees only orders already handed to production.",
  qc: "Records quality-check outcomes and reads production. No access to the order book.",
  finance: "Payments, refunds and reporting. Can read orders but not edit them.",
  support: "Enquiries, chat and customer records. Reads orders but cannot change them.",
  marketing: "Campaigns, content, reviews and analytics. No access to orders or payments.",
  staff: "Deprecated. Read-only on orders and enquiries — assign a specific role instead.",
};

export const PERMISSIONS = [
  "roles.manage",
  "settings.manage",
  "orders.read",
  "orders.write",
  "quotations.read",
  "quotations.write",
  "customers.read",
  "payments.read",
  "payments.write",
  "payments.refund",
  "production.read",
  "production.write",
  "qc.write",
  "shipping.write",
  "inventory.write",
  "enquiries.read",
  "enquiries.write",
  "catalog.read",
  "catalog.write",
  "content.write",
  "marketing.write",
  "reviews.moderate",
  "analytics.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Default mapping, mirroring the migration's seed. `super_admin` is
 * absent deliberately: it holds everything implicitly, both here and in
 * `has_permission()`, so a permission added by a later module cannot
 * accidentally lock out the one role that must never be locked out.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: [...PERMISSIONS],
  admin: PERMISSIONS.filter((p) => p !== "roles.manage"),
  sales: [
    "orders.read",
    "orders.write",
    "quotations.read",
    "quotations.write",
    "customers.read",
    "enquiries.read",
    "enquiries.write",
    "catalog.read",
  ],
  // NOT orders.read, for either of these. Module 13 (0034) deliberately
  // scoped production staff to orders that have actually been handed to
  // production — "not the full order book, not orders still in
  // sales/negotiation" — through is_production_staff(), and a blanket
  // orders.read would quietly undo that. 0055 removed it after
  // test-production.mjs caught the over-grant. Measurements are reachable
  // under production.read instead.
  production: [
    "production.read",
    "production.write",
    "shipping.write",
    "inventory.write",
    "catalog.read",
  ],
  qc: ["production.read", "qc.write"],
  finance: ["payments.read", "payments.write", "payments.refund", "orders.read", "analytics.read"],
  support: ["enquiries.read", "enquiries.write", "customers.read", "orders.read"],
  marketing: [
    "content.write",
    "marketing.write",
    "reviews.moderate",
    "analytics.read",
    "catalog.read",
  ],
  staff: ["orders.read", "enquiries.read"],
};

export function isAdminRole(role: string): role is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

/** Mirror of the SQL `has_permission()`. See the file header on why the database wins. */
export function roleHasPermission(role: string, permission: Permission): boolean {
  if (role === "super_admin") return true;
  if (!isAdminRole(role)) return false;
  return DEFAULT_ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Which permission each admin route needs.
 *
 * Deliberately ONE map, consumed by three places that would otherwise
 * drift apart: the middleware route guard, the sidebar (which hides what
 * a role cannot use), and any page that wants an explicit check of its
 * own. A new admin screen is listed here once.
 *
 * Matched by prefix, longest first, so `/admin/orders/abc123` inherits
 * `/admin/orders`. `/admin` itself is absent on purpose: the dashboard is
 * the landing page every admin role is allowed, and it is also where a
 * refused route redirects to — a rule requiring a permission for it could
 * only produce a redirect loop.
 */
export const ADMIN_ROUTE_PERMISSIONS: { prefix: string; permission: Permission }[] = [
  { prefix: "/admin/team", permission: "roles.manage" },
  { prefix: "/admin/settings", permission: "settings.manage" },
  { prefix: "/admin/orders", permission: "orders.read" },
  { prefix: "/admin/customers", permission: "customers.read" },
  { prefix: "/admin/quotations", permission: "quotations.read" },
  { prefix: "/admin/payments", permission: "payments.read" },
  { prefix: "/admin/enquiries", permission: "enquiries.read" },
  { prefix: "/admin/appointments", permission: "enquiries.read" },
  { prefix: "/admin/production", permission: "production.read" },
  { prefix: "/admin/shipping", permission: "shipping.write" },
  { prefix: "/admin/products", permission: "catalog.read" },
  { prefix: "/admin/collections", permission: "catalog.read" },
  { prefix: "/admin/categories", permission: "catalog.read" },
  { prefix: "/admin/measurements", permission: "orders.read" },
  { prefix: "/admin/media", permission: "catalog.read" },
  { prefix: "/admin/builder", permission: "catalog.read" },
  { prefix: "/admin/inventory", permission: "inventory.write" },
  { prefix: "/admin/reviews", permission: "reviews.moderate" },
  { prefix: "/admin/marketing", permission: "marketing.write" },
  { prefix: "/admin/content", permission: "content.write" },
  { prefix: "/admin/seo", permission: "content.write" },
  { prefix: "/admin/analytics", permission: "analytics.read" },
];

/** The permission `pathname` requires, or null when any admin role may see it. */
export function permissionForAdminPath(pathname: string): Permission | null {
  let best: { prefix: string; permission: Permission } | null = null;
  for (const rule of ADMIN_ROUTE_PERMISSIONS) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + "/")) {
      if (!best || rule.prefix.length > best.prefix.length) best = rule;
    }
  }
  return best?.permission ?? null;
}

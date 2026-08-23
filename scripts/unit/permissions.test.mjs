// Unit tests for lib/auth/permissions.ts — the role/permission mirror.
//
// This file MIRRORS the SQL seed in 0053. The database is the source of
// truth and test-permissions.mjs checks the two agree against a live
// database; these tests cover the properties that hold regardless of what
// is seeded, and that a live check would be a slow way to assert.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  isAdminRole,
  permissionForAdminPath,
  roleHasPermission,
} from "../../src/lib/auth/permissions.ts";

test("every admin role has a label and a description", () => {
  for (const role of ADMIN_ROLES) {
    assert.ok(ROLE_LABELS[role], `missing label for ${role}`);
    assert.ok(ROLE_DESCRIPTIONS[role], `missing description for ${role}`);
  }
});

test("every role's default permissions are real permission keys", () => {
  for (const role of ADMIN_ROLES) {
    for (const permission of DEFAULT_ROLE_PERMISSIONS[role]) {
      assert.ok(
        PERMISSIONS.includes(permission),
        `${role} grants unknown permission ${permission}`
      );
    }
  }
});

test("permission keys are unique", () => {
  assert.equal(new Set(PERMISSIONS).size, PERMISSIONS.length);
});

test("super_admin holds every permission", () => {
  for (const permission of PERMISSIONS) {
    assert.equal(roleHasPermission("super_admin", permission), true, permission);
  }
});

test("a plain admin holds everything EXCEPT roles.manage", () => {
  // The deliberate narrowing from Module 26: role assignment is
  // super_admin only, so a compromised admin account cannot escalate.
  assert.equal(roleHasPermission("admin", "roles.manage"), false);
  for (const permission of PERMISSIONS.filter((p) => p !== "roles.manage")) {
    assert.equal(roleHasPermission("admin", permission), true, permission);
  }
});

test("only super_admin can manage roles", () => {
  for (const role of ADMIN_ROLES.filter((r) => r !== "super_admin")) {
    assert.equal(roleHasPermission(role, "roles.manage"), false, role);
  }
});

test("a customer holds nothing", () => {
  for (const permission of PERMISSIONS) {
    assert.equal(roleHasPermission("customer", permission), false, permission);
  }
});

test("an unknown role holds nothing (fails closed)", () => {
  assert.equal(roleHasPermission("wizard", "orders.read"), false);
  assert.equal(isAdminRole("wizard"), false);
});

test("production and qc do NOT hold orders.read", () => {
  // Module 26 removed it after test-production.mjs caught the over-grant:
  // Module 13 scoped production staff to orders actually handed to
  // production, and a blanket orders.read quietly undid that.
  assert.equal(roleHasPermission("production", "orders.read"), false);
  assert.equal(roleHasPermission("qc", "orders.read"), false);
});

test("no non-admin role holds a payments permission", () => {
  for (const role of ["sales", "production", "qc", "support", "marketing"]) {
    for (const permission of PERMISSIONS.filter((p) => p.startsWith("payments."))) {
      assert.equal(roleHasPermission(role, permission), false, `${role} / ${permission}`);
    }
  }
});

test("admin route permissions resolve by longest prefix", () => {
  assert.equal(permissionForAdminPath("/admin/team"), "roles.manage");
  assert.equal(permissionForAdminPath("/admin/payments"), "payments.read");
  // Nested routes inherit their prefix, so a guard cannot be walked
  // around by going one level deeper.
  assert.equal(permissionForAdminPath("/admin/payments/abc123"), "payments.read");
});

test("/admin itself requires no permission", () => {
  // It is the landing page every admin role may reach AND the redirect
  // target for a refused route — a rule here could only loop.
  assert.equal(permissionForAdminPath("/admin"), null);
});

test("an unmapped admin route requires no specific permission", () => {
  assert.equal(permissionForAdminPath("/admin/not-a-real-page"), null);
});

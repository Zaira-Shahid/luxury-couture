"use server";

import { revalidatePath } from "next/cache";

import { getProfile, requirePermission } from "@/lib/auth/session";
import { isAdminRole, PERMISSIONS, type AppRole, type Permission } from "@/lib/auth/permissions";
import { logger } from "@/lib/logger";
import { logAudit } from "@/lib/security/audit";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true };

const ASSIGNABLE_ROLES: AppRole[] = [
  "customer",
  "super_admin",
  "admin",
  "sales",
  "production",
  "qc",
  "finance",
  "support",
  "marketing",
  "staff",
];

/**
 * Assigns a role to one account.
 *
 * Three independent layers have to agree before this succeeds, and that
 * is deliberate:
 *
 *  1. `requirePermission('roles.manage')` here — fails fast with a
 *     message, and covers the fact that a Server Action is an
 *     independently addressable POST endpoint the (admin) layout does not
 *     protect.
 *  2. RLS on `profiles`.
 *  3. The `prevent_role_self_promotion()` trigger from 0017/0018, which
 *     raises unconditionally on any role change by a caller without
 *     `roles.manage`. It is the real backstop — if this function were
 *     deleted tomorrow the database would still refuse.
 */
export async function assignRole(userId: string, role: string): Promise<ActionResult> {
  const denied = await requirePermission("roles.manage");
  if (denied) return denied;

  if (!ASSIGNABLE_ROLES.includes(role as AppRole)) return { error: "Unknown role." };

  const profile = await getProfile();
  if (!profile) return { error: "Not authorised." };

  // Self-demotion is blocked, not because the database would refuse it —
  // it would happily allow it — but because it is irreversible from the
  // UI: the last super_admin demoting themselves leaves nobody able to
  // promote anyone back, and recovery means hand-editing the database.
  if (profile.id === userId && role !== profile.role) {
    return { error: "You cannot change your own role. Ask another Super Admin." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);

  if (error) {
    logger.error("assignRole failed", { userId, role, message: error.message });
    return { error: "Could not change that role." };
  }

  await logAudit({
    action: "role.assigned",
    entityType: "profile",
    entityId: userId,
    after: { role },
    actorId: profile.id,
  });

  revalidatePath("/admin/team");
  return { success: true };
}

/**
 * Replaces the permission set for one role.
 *
 * `super_admin` is refused outright: it holds everything implicitly in
 * `has_permission()` rather than by stored rows, so editing its rows
 * would be theatre — it would change this screen without changing what
 * the database allows. Refusing is more honest than showing checkboxes
 * that do nothing.
 *
 * `roles.manage` is not removable from a role that has it via this form
 * either; the field is disabled in the UI and the value is preserved
 * here, so an accidental save cannot strand the installation with nobody
 * able to manage roles.
 */
export async function updateRolePermissions(
  role: string,
  formData: FormData
): Promise<ActionResult> {
  const denied = await requirePermission("roles.manage");
  if (denied) return denied;

  if (role === "super_admin") {
    return { error: "Super Admin always holds every permission and cannot be edited." };
  }
  if (!isAdminRole(role)) return { error: "That role has no admin permissions." };

  const submitted = new Set(formData.getAll("permission").map(String));
  const keys = PERMISSIONS.filter((key) => submitted.has(key)) as Permission[];

  const supabase = await createClient();

  // Preserve roles.manage rather than trusting the form: the checkbox is
  // rendered disabled, and a disabled checkbox submits nothing.
  const { data: existing } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role", role)
    .eq("permission_key", "roles.manage")
    .maybeSingle();
  if (existing && !keys.includes("roles.manage")) keys.push("roles.manage");

  const { error: deleteError } = await supabase.from("role_permissions").delete().eq("role", role);
  if (deleteError) {
    logger.error("updateRolePermissions delete failed", { role, message: deleteError.message });
    return { error: "Could not update those permissions." };
  }

  if (keys.length > 0) {
    const { error: insertError } = await supabase
      .from("role_permissions")
      .insert(keys.map((permission_key) => ({ role, permission_key })));
    if (insertError) {
      logger.error("updateRolePermissions insert failed", { role, message: insertError.message });
      // The delete already landed. Say so plainly instead of reporting a
      // generic failure that leaves the operator thinking nothing changed.
      return { error: "Permissions were cleared but not re-saved. Set them again." };
    }
  }

  revalidatePath("/admin/team");
  return { success: true };
}

/**
 * Gives an existing account an admin role, found by its sign-in email.
 *
 * Deliberately does NOT create accounts. Someone must already have
 * signed up through the normal flow — which means they have set their
 * own password and verified their own address, and this screen never
 * handles a credential. It also means "grant access" can never
 * accidentally mint a staff login for an address nobody controls.
 *
 * The lookup needs the service-role client because emails live in
 * auth.users, which RLS does not expose. The permission check above runs
 * FIRST, before any elevated client is constructed.
 */
export async function grantAccessByEmail(formData: FormData): Promise<ActionResult> {
  const denied = await requirePermission("roles.manage");
  if (denied) return denied;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  if (!email) return { error: "Enter an email address." };
  if (!isAdminRole(role)) return { error: "Choose a staff role." };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  // listUsers is paginated; this business has a small user base, but page
  // through rather than assume the first 1000 rows contain the match.
  let match: { id: string } | undefined;
  for (let page = 1; page <= 20 && !match; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      logger.error("grantAccessByEmail lookup failed", { message: error.message });
      return { error: "Could not look up that account." };
    }
    if (!data.users.length) break;
    match = data.users.find((user) => user.email?.toLowerCase() === email);
  }

  if (!match) {
    return { error: "No account with that email. Ask them to sign up first, then grant access." };
  }

  return assignRole(match.id, role);
}

import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Profile, RolePermission } from "@/types/database";

export type TeamMember = Profile & { email: string | null };

/**
 * Every account holding an admin role, with its sign-in email.
 *
 * Email lives in `auth.users`, not `profiles`, so it comes from the
 * service-role client — the same narrow read-only elevation
 * `getAdminCustomerDetail` already uses. The list is bounded by the
 * number of staff (single digits for this business), so resolving each
 * email individually is fine; a customer list would not be.
 */
export async function getTeam(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("role", [...ADMIN_ROLES])
    .order("created_at", { ascending: true });

  if (error) {
    logger.warn("failed to load team", { message: error.message });
    return [];
  }

  const profiles = (data ?? []) as Profile[];
  const admin = createAdminClient();
  return Promise.all(
    profiles.map(async (profile) => {
      const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
      return { ...profile, email: authUser?.user?.email ?? null };
    })
  );
}

/** The stored matrix, as role -> permission keys. Excludes super_admin, which holds everything implicitly. */
export async function getRolePermissionMatrix(): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("role_permissions").select("role, permission_key");

  if (error) {
    logger.warn("failed to load role permissions", { message: error.message });
    return {};
  }

  const matrix: Record<string, string[]> = {};
  for (const row of (data ?? []) as RolePermission[]) {
    (matrix[row.role] ??= []).push(row.permission_key);
  }
  return matrix;
}

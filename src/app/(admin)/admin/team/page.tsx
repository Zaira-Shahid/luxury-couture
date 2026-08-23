import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  ADMIN_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type AdminRole,
} from "@/lib/auth/permissions";
import { getProfile, hasPermission } from "@/lib/auth/session";
import { getRolePermissionMatrix, getTeam } from "@/lib/admin/get-team";

import { TeamScreen } from "./team-screen";

export const metadata: Metadata = { title: "Team & Roles" };

export default async function AdminTeamPage() {
  // The route guard, not the hidden nav item. The sidebar filtering is
  // cosmetic; this is what actually stops a Sales account typing the URL.
  // RLS refuses the writes underneath regardless.
  if (!(await hasPermission("roles.manage"))) redirect("/admin");

  const profile = await getProfile();
  const [team, matrix] = await Promise.all([getTeam(), getRolePermissionMatrix()]);

  // super_admin is absent from the stored matrix on purpose — it holds
  // everything implicitly in has_permission(). Fill it in for display so
  // the screen reads honestly, with editing refused in the action.
  const editableRoles = ADMIN_ROLES.filter((role) => role !== "super_admin");

  return (
    <div className="flex flex-col gap-8 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl tracking-wide">Team &amp; Roles</h1>
        <p className="text-sm text-muted-foreground">
          Who can reach the admin area, and what each role is allowed to do. Changes take effect the
          next time that person loads a page.
        </p>
      </header>

      <TeamScreen
        currentUserId={profile?.id ?? ""}
        team={team.map((member) => ({
          id: member.id,
          email: member.email,
          fullName: member.full_name,
          role: member.role,
        }))}
        roles={ADMIN_ROLES.map((role) => ({
          value: role,
          label: ROLE_LABELS[role],
          description: ROLE_DESCRIPTIONS[role],
        }))}
        editableRoles={editableRoles.map((role) => ({
          value: role,
          label: ROLE_LABELS[role],
          description: ROLE_DESCRIPTIONS[role],
          granted: matrix[role] ?? [...DEFAULT_ROLE_PERMISSIONS[role as AdminRole]],
        }))}
        permissions={[...PERMISSIONS]}
      />
    </div>
  );
}

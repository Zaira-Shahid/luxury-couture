"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignRole,
  grantAccessByEmail,
  updateRolePermissions,
} from "@/features/admin-team/actions";

type RoleOption = { value: string; label: string; description: string };
type EditableRole = RoleOption & { granted: string[] };
type Member = { id: string; email: string | null; fullName: string | null; role: string };

/**
 * Standard admin form shape for this project: a client wrapper calling
 * server actions inside useTransition, since React 18 has no
 * useActionState (see docs/ARCHITECTURE.md).
 *
 * Everything here is convenience. The authorisation lives in the server
 * actions, the route guard and RLS — a disabled control is a courtesy to
 * the operator, never a boundary.
 */
export function TeamScreen({
  currentUserId,
  team,
  roles,
  editableRoles,
  permissions,
}: {
  currentUserId: string;
  team: Member[];
  roles: RoleOption[];
  editableRoles: EditableRole[];
  permissions: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState(editableRoles[0]?.value ?? "");
  const active = editableRoles.find((role) => role.value === selectedRole);

  function run(work: () => Promise<{ error: string } | { success: true }>, done: string) {
    startTransition(async () => {
      const result = await work();
      if ("error" in result) toast.error(result.error);
      else toast.success(done);
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg tracking-wide">Staff accounts</h2>

        {team.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            No staff accounts yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {team.map((member) => {
                  const isSelf = member.id === currentUserId;
                  return (
                    <tr key={member.id} className="border-t border-border">
                      <td className="px-4 py-2">{member.fullName ?? "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{member.email ?? "—"}</td>
                      <td className="px-4 py-2">
                        <select
                          className="rounded-md border border-input bg-background px-2 py-1 text-sm disabled:opacity-60"
                          defaultValue={member.role}
                          // Changing your own role is refused server-side too. The last
                          // Super Admin demoting themselves would leave nobody able to
                          // promote anyone back.
                          disabled={isSelf || isPending}
                          title={isSelf ? "You cannot change your own role." : undefined}
                          onChange={(event) =>
                            run(() => assignRole(member.id, event.target.value), "Role updated.")
                          }
                        >
                          {roles.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                          <option value="customer">Customer (removes admin access)</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <form
          action={(formData) => run(() => grantAccessByEmail(formData), "Access granted.")}
          className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-end"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="team-email">Grant access to an existing account</Label>
            <Input id="team-email" name="email" type="email" placeholder="name@example.com" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team-role">Role</Label>
            <select
              id="team-role"
              name="role"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              defaultValue="sales"
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={isPending}>
            Grant access
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          The person must have signed up already — this never creates an account or sets a password.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg tracking-wide">What each role can do</h2>

        <div className="flex flex-wrap gap-2">
          {editableRoles.map((role) => (
            <button
              key={role.value}
              type="button"
              onClick={() => setSelectedRole(role.value)}
              className={
                role.value === selectedRole
                  ? "rounded-full bg-foreground px-3 py-1 text-sm text-background"
                  : "rounded-full border border-border px-3 py-1 text-sm"
              }
            >
              {role.label}
            </button>
          ))}
        </div>

        {active ? (
          <form
            key={active.value}
            action={(formData) =>
              run(() => updateRolePermissions(active.value, formData), "Permissions saved.")
            }
            className="flex flex-col gap-4 rounded-lg border border-border p-4"
          >
            <p className="text-sm text-muted-foreground">{active.description}</p>

            <div className="grid gap-2 sm:grid-cols-2">
              {permissions.map((permission) => {
                // roles.manage is shown but never editable here: removing it from the
                // last role that has it would strand the installation with nobody able
                // to manage roles. The server preserves it regardless of what is sent.
                const locked = permission === "roles.manage";
                return (
                  <label key={permission} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="permission"
                      value={permission}
                      defaultChecked={active.granted.includes(permission)}
                      disabled={locked}
                      className="mt-0.5 size-4"
                    />
                    <span className={locked ? "text-muted-foreground" : undefined}>
                      {permission}
                      {locked ? " (Super Admin only)" : ""}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isPending}>
                Save permissions
              </Button>
              <span className="text-xs text-muted-foreground">
                Super Admin always holds every permission and is not listed here.
              </span>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}

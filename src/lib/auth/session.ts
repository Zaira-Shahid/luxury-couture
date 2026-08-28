import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

import { isAdminRole, type Permission } from "./permissions";

export type { Profile };

/** Current authenticated user, or null. Verifies with Supabase's Auth server (not just the local cookie). */
export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Current user's profile row (role, name, etc.), or null when signed out. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return profile ?? null;
}

/**
 * Whether a role may reach the admin area at all. Module 26 widened this
 * from the original three roles to every admin role.
 *
 * This is a COARSE gate — it answers "should this person see an admin
 * shell", not "may they do this". Per-capability checks are
 * `hasPermission()` below, and RLS is the real boundary underneath both.
 */
export function isStaffRole(role: UserRole) {
  return isAdminRole(role);
}

/**
 * The signed-in user's permissions, read from the DATABASE rather than
 * the code mirror in permissions.ts — the matrix is editable in
 * Admin → Team, so the stored rows are the source of truth.
 *
 * Memoized per request: a page rendering several permission-gated
 * sections would otherwise re-query for each one.
 *
 * Fails CLOSED. Any error, or no profile, yields an empty set — a broken
 * lookup must never read as "allowed".
 */
export const getMyPermissions = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return new Set();

  return loadPermissionsForRole(supabase, profile.role);
});

/**
 * The permission lookup itself, taking the client rather than building one.
 *
 * Extracted from `getMyPermissions()` in Module 36 so the MCP layer can
 * reuse it: an MCP call may authenticate with a Bearer access token rather
 * than a cookie, so it holds a Supabase client that this file's
 * `createClient()` cannot produce. Copying the query there instead would
 * have meant two places where "what does this role hold" is decided — and
 * the moment they disagree, one of them is a security hole.
 *
 * Fails CLOSED, like its caller: any error yields an empty set.
 */
export async function loadPermissionsForRole(
  supabase: SupabaseClient,
  role: string
): Promise<Set<string>> {
  // super_admin holds everything implicitly, matching has_permission().
  if (role === "super_admin") {
    const { data: all } = await supabase.from("permissions").select("key");
    return new Set((all ?? []).map((row) => row.key as string));
  }

  const { data: rows } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role", role);

  return new Set((rows ?? []).map((row) => row.permission_key as string));
}

/** True when the signed-in user holds `permission`. */
export async function hasPermission(permission: Permission): Promise<boolean> {
  return (await getMyPermissions()).has(permission);
}

/**
 * Guard for Server Actions.
 *
 * Server Actions are independently addressable POST endpoints — the
 * (admin) layout guard does not protect them and a hidden button is only
 * a convenience, so every permission-gated action calls this. RLS still
 * sits underneath as the real boundary; this exists to fail fast with a
 * message a human can act on rather than a generic write error.
 */
export async function requirePermission(
  permission: Permission
): Promise<{ error: string } | null> {
  if (await hasPermission(permission)) return null;
  return { error: "You don't have permission to do that." };
}

import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

export type { Profile };

const STAFF_ROLES: ReadonlyArray<UserRole> = ["admin", "staff", "production"];

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

export function isStaffRole(role: UserRole) {
  return STAFF_ROLES.includes(role);
}

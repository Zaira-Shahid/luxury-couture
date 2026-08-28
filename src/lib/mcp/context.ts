import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminRole, Permission } from "@/lib/auth/permissions";

/**
 * Who a tool call is running as, and the database handle it must use.
 *
 * THE ACTOR IS A PERSON, not the AI and not a service account. That is
 * the consequence of the authentication decision recorded in Master Build
 * Plan section 12B.3: the caller presents a real Supabase session, so
 * `id` is a real `profiles.id`, `role` is their real role, and the audit
 * trail names them rather than a shared robot identity.
 */
export type McpActor = {
  id: string;
  email: string | null;
  role: AdminRole;
  /**
   * Read from `role_permissions` in the DATABASE, not from the code
   * mirror in permissions.ts — the matrix is editable in Admin -> Team,
   * so the stored rows are the source of truth (see the header of
   * lib/auth/permissions.ts).
   */
  permissions: Set<string>;
};

export type McpContext = {
  actor: McpActor;
  /**
   * The CALLER'S Supabase client, carrying their session.
   *
   * Deliberately not the service-role client. Every tool query therefore
   * runs under RLS as the signed-in human, so Postgres refuses anything
   * they could not have done through the admin UI — which is what makes
   * "the AI cannot reach arbitrary data" true underneath the registry
   * rather than only because of it.
   */
  supabase: SupabaseClient;
  /** Correlates every log line and audit row emitted by one tool call. */
  requestId: string;
  /** When the call started. Passed rather than read, so results are testable. */
  now: Date;
};

export function actorHasPermission(actor: McpActor, permission: Permission): boolean {
  return actor.permissions.has(permission);
}

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import { isAdminRole } from "@/lib/auth/permissions";
import { loadPermissionsForRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import type { McpActor } from "./context";
import { McpError } from "./errors";
import type { AnyToolDefinition } from "./registry";

/**
 * Authentication and authorization for the MCP endpoint
 * (Master Build Plan sections 12B.3 and 12B.4).
 *
 * THE DECISION THIS IMPLEMENTS: the caller presents the application's own
 * Supabase session. There is no MCP API key, no service account and no
 * second user store, so the actor is a real human with a real role and
 * every existing control — `has_permission()`, `role_permissions`, and the
 * RLS policies on every table — applies to an AI-driven call exactly as it
 * applies to a click in the admin UI.
 *
 * Two transports for the same session, because the two clients differ:
 *   - the browser (Module 42's admin chat) sends the auth COOKIE
 *   - an external MCP client sends `Authorization: Bearer <access token>`
 *
 * Both resolve to the same `McpActor`. Neither can present a role it does
 * not have: the role is read from `profiles` server-side, never taken from
 * the request.
 */

/**
 * Builds a Supabase client bound to a Bearer access token.
 *
 * ANON KEY, not the service-role key. The token is what grants access, so
 * `auth.uid()` inside Postgres is the token's user and RLS applies
 * normally. Using the service-role client here would silently disable
 * every policy — which is exactly the mistake this comment exists to
 * prevent someone making later for convenience.
 */
function createBearerClient(accessToken: string): SupabaseClient {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}

function bearerToken(headers: Headers): string | null {
  const header = headers.get("authorization");
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token || null;
}

export type ResolvedCaller = { actor: McpActor; supabase: SupabaseClient };

/**
 * Resolves who is calling, or throws a controlled error.
 *
 * The order is the order in section 12B.4 and it matters: authentication
 * before role, role before permissions. Answering "you lack permission X"
 * to an anonymous caller would confirm that X exists to someone who has
 * not proved they are anyone at all.
 */
export async function resolveCaller(headers: Headers): Promise<ResolvedCaller> {
  const token = bearerToken(headers);
  const supabase = token ? createBearerClient(token) : await createClient();

  // 1. Authenticated? Verified against Supabase's auth server, not just
  //    read from the cookie — a cookie is client-supplied data.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new McpError("UNAUTHORIZED", "Sign in to use the assistant.");
  }

  // 2. An admin role? Read from the database under the caller's own RLS
  //    (a profile is readable by its owner), never from the request.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as string | undefined;

  // Fails closed twice over: no profile row, or a role that is not an
  // admin role — a `customer` included — reaches no MCP tool at all.
  if (!role || !isAdminRole(role)) {
    throw new McpError("FORBIDDEN", "This assistant is only available to staff accounts.");
  }

  const permissions = await loadPermissionsForRole(supabase, role);

  return {
    supabase,
    actor: { id: user.id, email: user.email ?? null, role, permissions },
  };
}

/**
 * 3. Does the actor hold the tool's permission?
 *
 * Runs on EVERY `tools/call`, independently of what `tools/list` showed
 * the client. Filtering the list is a convenience so an assistant is not
 * tempted by tools it cannot use; it is not the enforcement, because a
 * client can call a name it was never given. This function is the
 * enforcement in the application layer, and RLS is the enforcement
 * underneath it.
 */
export function assertToolAccess(tool: AnyToolDefinition, actor: McpActor): void {
  if (tool.permission === null) return;
  if (actor.permissions.has(tool.permission)) return;
  // The message names the capability, not the internal key set, and is
  // identical to the one Server Actions give for the same refusal.
  throw new McpError("FORBIDDEN", "You don't have permission to do that.");
}

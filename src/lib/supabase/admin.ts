import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS entirely — use only in
 * server-only code (Server Actions, Route Handlers) for privileged writes
 * that must not go through the anon/authenticated RLS path (order status,
 * payment records, production/shipping updates, etc).
 *
 * NEVER import this file from a Client Component or any code that could
 * end up in a browser bundle.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

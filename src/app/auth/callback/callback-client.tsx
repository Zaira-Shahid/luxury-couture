"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Supabase's default email templates (signup confirmation, password
 * recovery) link through Supabase's own /verify endpoint, which mints the
 * session itself and redirects here with tokens in the URL *fragment*
 * (`#access_token=...&refresh_token=...`), not a `?code=` query param —
 * fragments never reach the server, so this has to run client-side.
 * (Confirmed empirically with scripts/test-email-flows.mjs — a server
 * route reading `code` never saw one.)
 */
export function CallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = searchParams.get("next") ?? "/account";
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const hashError = hashParams.get("error_description") ?? searchParams.get("error_description");

    if (hashError) {
      setError(hashError);
      return;
    }

    if (!accessToken || !refreshToken) {
      setError("This link is invalid or has expired.");
      return;
    }

    const supabase = createClient();
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) {
        setError(error.message);
        return;
      }
      router.replace(next);
    });
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-destructive">{error}</p>
        {/*
          <Link>, not <a>. A plain anchor forces a full page reload here,
          which throws away the client-side auth state this component has
          just been working with. Latent since Module 2 — it only surfaced
          on a clean build, because Next caches lint results between
          incremental builds and this file had not changed since.
        */}
        <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">Signing you in…</p>;
}

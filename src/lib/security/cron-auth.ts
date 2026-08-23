import { type NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";

/**
 * Authorization for Vercel Cron endpoints.
 *
 * MODULE 29 — THE BUG THIS FIXES. Every cron route previously did:
 *
 *     const cronSecret = process.env.CRON_SECRET;
 *     if (cronSecret) { ...check the bearer token... }
 *
 * so when `CRON_SECRET` was unset the check was skipped entirely and the
 * route became a public, unauthenticated endpoint. That was a deliberate
 * "unset = not configured yet" tolerance for local development, and it
 * matched the project's convention elsewhere — but these are not
 * read-only routes. One of them emails customers. Another deletes
 * analytics rows. A third will now reap cart rows.
 *
 * The audit recorded it as a HIGH finding rather than a local-config
 * quirk, because a missing environment variable in production silently
 * turns "protected" into "open to anyone who guesses the URL", and
 * nothing about the code would tell you.
 *
 * SO IT NOW FAILS CLOSED IN PRODUCTION. The convenience of running a
 * cron locally without a secret is kept, but it can only apply outside
 * production, and it logs loudly when it does.
 */
export function authorizeCron(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
  }

  // No secret configured.
  if (process.env.NODE_ENV === "production") {
    logger.error(
      "cron endpoint called with no CRON_SECRET configured — refusing",
      undefined,
      { path: request.nextUrl.pathname }
    );
    // 503, not 401: the caller did nothing wrong, the deployment is
    // misconfigured. A 401 would send someone hunting for a bad token
    // instead of a missing variable.
    return NextResponse.json(
      { error: "Cron is not configured on this deployment." },
      { status: 503 }
    );
  }

  logger.warn("cron endpoint running WITHOUT authentication (non-production only)", {
    path: request.nextUrl.pathname,
  });
  return null;
}

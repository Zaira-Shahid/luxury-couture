import { cookies } from "next/headers";

const COOKIE_NAME = "cart_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

/**
 * A cart isn't naturally "shareable" the way a builder design is (Module
 * 6's id+token URL), so guest cart identity lives in a cookie instead.
 * Ignored once signed in — get_or_create_cart (0030) always prefers
 * auth.uid() over this value.
 */
export async function getOrCreateCartSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const sessionId = crypto.randomUUID();
  cookieStore.set(COOKIE_NAME, sessionId, {
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
  });
  return sessionId;
}

/**
 * Read-only variant for contexts that can't mutate cookies — Server
 * Components (SiteHeader) render outside a Server Action/Route Handler,
 * where `cookies().set(...)` throws. Returns null rather than minting a
 * new session just to display a count for a visitor with no cart yet.
 */
export async function peekCartSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

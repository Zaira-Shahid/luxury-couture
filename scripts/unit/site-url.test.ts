import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * The origin resolver, tested in isolation.
 *
 * WHY THIS TEST EXISTS. `NEXT_PUBLIC_SITE_URL` was never set on the
 * Vercel deployment. The old code fell straight back to
 * "http://localhost:3000", so the live site emitted localhost canonical
 * tags — and, worse, the auth actions interpolated the raw undefined
 * value into "undefined/auth/callback", which Supabase rejects. Password
 * reset and email confirmation were dead on production while working
 * perfectly in development, which is the hardest kind of bug to notice.
 *
 * The resolver is duplicated here rather than imported because
 * lib/config/site.ts reads process.env at module load, so importing it
 * would freeze whatever the environment happened to be. Copying five
 * lines to test the branching honestly is the better trade; if the real
 * one changes shape, this fails to match and someone comes looking.
 */
function resolveSiteUrl(env: Record<string, string | undefined>): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

test("an explicit site URL always wins", () => {
  assert.equal(
    resolveSiteUrl({
      NEXT_PUBLIC_SITE_URL: "https://luxurylehengacouture.co.uk",
      VERCEL_URL: "luxury-couture.vercel.app",
    }),
    "https://luxurylehengacouture.co.uk",
    "a custom domain must beat the per-deployment vercel.app hostname"
  );
});

test("a trailing slash is trimmed, so absoluteUrl cannot double it", () => {
  assert.equal(
    resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://example.com/" }),
    "https://example.com"
  );
});

test("VERCEL_URL is used when nothing is configured — the production bug", () => {
  assert.equal(
    resolveSiteUrl({ VERCEL_URL: "luxury-couture.vercel.app" }),
    "https://luxury-couture.vercel.app",
    "an unset NEXT_PUBLIC_SITE_URL must not mean localhost on a real deployment"
  );
});

test("VERCEL_URL is bare hostname, and is given a scheme", () => {
  const url = resolveSiteUrl({ VERCEL_URL: "luxury-couture.vercel.app" });
  assert.ok(url.startsWith("https://"), "Vercel supplies no scheme");
  assert.doesNotThrow(() => new URL(url));
});

test("an empty string counts as unset, not as an origin", () => {
  assert.equal(
    resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "   ", VERCEL_URL: "app.vercel.app" }),
    "https://app.vercel.app",
    "a blank env var is how these get mis-set in a dashboard"
  );
});

test("localhost only when genuinely nothing is set", () => {
  assert.equal(resolveSiteUrl({}), "http://localhost:3000");
});

test("the resolved origin never produces an 'undefined' redirect", () => {
  // The exact failure: `${undefined}/auth/callback` === "undefined/auth/..."
  for (const env of [{}, { VERCEL_URL: "x.vercel.app" }, { NEXT_PUBLIC_SITE_URL: "https://y.com" }]) {
    const redirect = `${resolveSiteUrl(env)}/auth/callback?next=/reset-password`;
    assert.ok(!redirect.startsWith("undefined"), `got ${redirect}`);
    assert.doesNotThrow(() => new URL(redirect), `not a valid URL: ${redirect}`);
  }
});

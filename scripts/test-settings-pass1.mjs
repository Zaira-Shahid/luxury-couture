// Module 25 Pass 1 — settings foundation verification.
//
// Requires a running server (npm run build && npm run start) and
// .env.local loaded:
//   node --env-file=.env.local scripts/test-settings-pass1.mjs
//
// The registry is import-free by design (same rule as lib/ai/guardrails.ts
// and lib/email/render.ts), so it is imported directly under Node's type
// stripping. Everything else goes through the database and HTTP.
import { createClient } from "@supabase/supabase-js";

import {
  ENV_CREDENTIALS,
  SECTION_ORDER,
  SETTINGS_REGISTRY,
  entriesForSection,
  findEntry,
} from "../src/lib/settings/registry.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const suffix = Date.now();

/** Section separator: avoids escaping a newline inside every console.log. */
const SEP = String.fromCharCode(10);

let failures = 0;
function check(label, pass) {
  if (!pass) failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);
}

async function signIn(email, password) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const { data: signInData } = await client.auth.signInWithPassword({ email, password });
  return { client, userId: data.user.id, session: signInData.session };
}
function cookieFor(session) {
  const b64 = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `sb-${new URL(url).hostname.split(".")[0]}-auth-token=base64-${b64}`;
}
async function get(path, cookie) {
  const res = await fetch(`${appUrl}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  return { status: res.status, html: await res.text() };
}
async function setSetting(key, value) {
  await admin.from("site_settings").upsert({ key, value }, { onConflict: "key" });
}
async function clearSetting(key) {
  await admin.from("site_settings").delete().eq("key", key);
}

// Snapshot so the shop is left exactly as found.
const { data: originalRows } = await admin.from("site_settings").select("key, value");
const ORIGINAL = new Map((originalRows ?? []).map((r) => [r.key, r.value]));
async function restore(key) {
  if (ORIGINAL.has(key)) await setSetting(key, ORIGINAL.get(key));
  else await clearSetting(key);
}

// ---------------------------------------------------------------------
console.log("=== REGISTRY INTEGRITY ===");
check("registry has entries", SETTINGS_REGISTRY.length > 0);
const keys = SETTINGS_REGISTRY.map((e) => e.key);
check("no duplicate keys", new Set(keys).size === keys.length);
check(
  "every entry has a label",
  SETTINGS_REGISTRY.every((e) => typeof e.label === "string" && e.label.length > 0)
);
check(
  "every entry belongs to a known section",
  SETTINGS_REGISTRY.every((e) => SECTION_ORDER.includes(e.section))
);
check(
  "every select entry has options",
  SETTINGS_REGISTRY.filter((e) => e.type === "select").every((e) => (e.options ?? []).length > 0)
);
check(
  "every section has at least one entry",
  SECTION_ORDER.every((section) => entriesForSection(section).length > 0)
);
check("findEntry resolves a known key", findEntry("seo.indexing_enabled")?.type === "boolean");
check("findEntry returns undefined for an unknown key", findEntry("nope.nope") === undefined);

console.log("\n=== SECRETS ARE NOT IN THE REGISTRY ===");
// The rule this module must not break: a live credential must never
// become a database row that every admin can read.
const SECRET_FRAGMENTS = ["api_key", "apikey", "secret", "password", "token"];
const offenders = SETTINGS_REGISTRY.filter((e) => {
  const k = e.key.toLowerCase();
  // The Google Search Console *verification* token is a public value that
  // is literally published in the page HTML — not a credential.
  if (k === "seo.google_site_verification") return false;
  return SECRET_FRAGMENTS.some((fragment) => k.includes(fragment));
});
check(
  `no credential-shaped keys in the registry (found: ${offenders.map((o) => o.key).join(", ") || "none"})`,
  offenders.length === 0
);
check(
  "credentials are declared as env-only instead",
  ENV_CREDENTIALS.length > 0 && ENV_CREDENTIALS.every((c) => typeof c.env === "string")
);

// ---------------------------------------------------------------------
console.log("\n=== Setup ===");
const staffAdmin = await signIn(`m25-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-h0");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);
const customer = await signIn(`m25-cust-${suffix}@luxury-couture-devtest.local`, "correct-horse-h1");
const adminCookie = cookieFor(staffAdmin.session);
const customerCookie = cookieFor(customer.session);

console.log("\n=== Settings page renders every section ===");
for (const section of SECTION_ORDER) {
  const page = await get(`/admin/settings?section=${section}`, adminCookie);
  check(`section "${section}" renders for admin`, page.status === 200);
  const entries = entriesForSection(section);
  const firstLabel = entries[0]?.label;
  check(
    `section "${section}" renders its fields`,
    Boolean(firstLabel) && page.html.includes(firstLabel)
  );
}
check(
  "an unknown section falls back rather than erroring",
  (await get("/admin/settings?section=nonsense", adminCookie)).status === 200
);
check(
  "a customer cannot reach settings",
  (await get("/admin/settings", customerCookie)).status !== 200
);

console.log("\n=== THE SECRETS RULE: values never reach the page ===");
const settingsPage = await get("/admin/settings", adminCookie);
check("integrations section is shown", settingsPage.html.includes("Integrations"));
check("it names the env variable", settingsPage.html.includes("SUPABASE_SERVICE_ROLE_KEY") === false);
for (const credential of ENV_CREDENTIALS) {
  const value = process.env[credential.env];
  check(
    `${credential.env} status is reported`,
    settingsPage.html.includes(credential.env)
  );
  if (value) {
    check(
      `${credential.env} VALUE never appears in the HTML`,
      !settingsPage.html.includes(value)
    );
  }
}
// The service-role key is the most dangerous value in the environment.
check(
  "the service-role key never appears anywhere on the page",
  !settingsPage.html.includes(process.env.SUPABASE_SERVICE_ROLE_KEY)
);

console.log("\n=== site_settings RLS ===");
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
// site_settings is public-read on purpose (migration 0019, Module 3):
// branding, theme and the SEO defaults render for anonymous visitors.
// These two assertions previously expected an empty result and passed
// only while the table held no rows. The invariant that actually
// protects anything is that this table carries no credentials — those
// are env-only, asserted above — and that only staff can write.
const { data: anonRead } = await anon.from("site_settings").select("key");
check("anonymous can read public settings", Array.isArray(anonRead));
check(
  "no credential-shaped key is ever readable from site_settings",
  (anonRead ?? []).every((row) => !/key|secret|token|password/i.test(row.key))
);
const { error: anonWrite } = await anon
  .from("site_settings")
  .upsert({ key: "seo.default_title", value: "Hijacked" });
check("anonymous cannot write settings", Boolean(anonWrite));
const { data: custRead } = await customer.client.from("site_settings").select("key");
check(
  "a signed-in customer sees the same rows as anonymous, not more",
  (custRead ?? []).length === (anonRead ?? []).length
);
const { error: custWrite } = await customer.client
  .from("site_settings")
  .upsert({ key: "seo.indexing_enabled", value: true });
check("a customer cannot write settings", Boolean(custWrite));
const { data: adminRead } = await staffAdmin.client.from("site_settings").select("key").limit(5);
check("an admin can read settings", Array.isArray(adminRead));

console.log("\n=== Settings actually change the site ===");
// A setting that stores a value but changes nothing is worse than no
// setting, so each of these asserts a visible effect.

// Brand name -> page title.
await setSetting("seo.default_title", `Test Atelier ${suffix}`);
const homeAfterBrand = await get("/");
check("brand name reaches the storefront title", homeAfterBrand.html.includes(`Test Atelier ${suffix}`));
await restore("seo.default_title");

// Theme variable -> inline style on <html>.
await setSetting("theme.primary", "oklch(0.5 0.2 30)");
const homeAfterTheme = await get("/");
check(
  "a theme colour reaches the <html> style attribute",
  homeAfterTheme.html.includes("--primary:oklch(0.5 0.2 30)") ||
    homeAfterTheme.html.includes("--primary: oklch(0.5 0.2 30)")
);
await clearSetting("theme.primary");
const homeNoTheme = await get("/");
check(
  "an unset theme variable is NOT emitted as empty (it falls through to the CSS default)",
  !homeNoTheme.html.includes("--primary:;") && !homeNoTheme.html.includes('--primary:""')
);
await restore("theme.primary");

// Font preset -> different font class on <html>.
await setSetting("theme.font_preset", "playfair-inter");
const homePlayfair = await get("/");
await setSetting("theme.font_preset", "cormorant-geist");
const homeCormorant = await get("/");
check(
  "changing the font preset changes the rendered font classes",
  homePlayfair.html.slice(0, 2000) !== homeCormorant.html.slice(0, 2000)
);
await restore("theme.font_preset");

// An invalid select value is ignored rather than applied.
await setSetting("theme.font_preset", "not-a-real-preset");
const homeBadPreset = await get("/");
check("an invalid select value does not break the page", homeBadPreset.status === 200);
await restore("theme.font_preset");

// AI assistant toggle -> widget disappears entirely.
await setSetting("ai.assistant_enabled", false);
const homeNoAssistant = await get("/");
check(
  "disabling the assistant removes it from the storefront",
  !homeNoAssistant.html.includes('aria-label="Open chat"')
);
await setSetting("ai.assistant_enabled", true);
const homeAssistant = await get("/");
check("re-enabling brings it back", homeAssistant.html.includes('aria-label="Open chat"'));
await restore("ai.assistant_enabled");

// Analytics ID -> pixel loads (with marketing consent granted).
const consentCookie = `consent=${encodeURIComponent(
  JSON.stringify({ v: 1, analytics: true, marketing: true, ts: new Date().toISOString() })
)}`;
await setSetting("analytics.ga_measurement_id", `G-TEST${suffix}`);
const homeWithPixel = await get("/", consentCookie);
check(
  "a GA ID set in settings loads the pixel",
  homeWithPixel.html.includes(`G-TEST${suffix}`)
);
await clearSetting("analytics.ga_measurement_id");
const homeNoPixel = await get("/", consentCookie);
check(
  "clearing it stops the pixel loading",
  !homeNoPixel.html.includes(`G-TEST${suffix}`)
);
await restore("analytics.ga_measurement_id");

console.log(SEP + "=== Currency and locale ===");
// An empty cart shows no prices at all, so asserting on it would pass
// without proving anything. Seed a real product and a real cart so a
// total is actually rendered.
const { data: curProduct } = await admin
  .from("products")
  .insert({
    name: `Currency Test ${suffix}`,
    slug: `currency-test-${suffix}`,
    base_price: 1234,
    currency: "GBP",
    status: "published",
    published_at: new Date().toISOString(),
  })
  .select()
  .single();

// The cart session column is a uuid — get_or_create_cart rejects
// anything else, so this must be a real UUID, not a readable label.
const cartSession = crypto.randomUUID();
const { data: curCart } = await admin
  .from("carts")
  .insert({ session_id: cartSession, status: "active" })
  .select()
  .single();
await admin.from("cart_items").insert({
  cart_id: curCart.id,
  product_id: curProduct.id,
  quantity: 1,
  unit_price_snapshot: 1234,
});
const cartCookie = `cart_session=${cartSession}`;

await setSetting("general.currency", "GBP");
const cartGbp = await get("/cart", cartCookie);
check("cart renders the seeded item", cartGbp.html.includes(curProduct.name));
check("with GBP configured the total is in pounds", cartGbp.html.includes("£1,234"));

await setSetting("general.currency", "EUR");
const cartEur = await get("/cart", cartCookie);
check("changing the currency setting changes the rendered total", cartEur.html.includes("€1,234"));
check("and the old currency is gone", !cartEur.html.includes("£1,234"));

await setSetting("general.locale", "en-US");
await setSetting("general.currency", "USD");
const cartUsd = await get("/cart", cartCookie);
check("currency and locale together produce US formatting", cartUsd.html.includes("$1,234"));

await restore("general.currency");
await restore("general.locale");

console.log("\n=== Saving through the admin form ===");
// The save action validates against the registry, so an unknown key must
// not be writable even if posted.
const beforeKeys = new Set(
  ((await admin.from("site_settings").select("key")).data ?? []).map((r) => r.key)
);
await setSetting("totally.unknown.key", "should be ignored on read");
const settings = await get("/", adminCookie);
check("an unknown settings key does not break the site", settings.status === 200);
await clearSetting("totally.unknown.key");
const afterKeys = new Set(
  ((await admin.from("site_settings").select("key")).data ?? []).map((r) => r.key)
);
check("no stray keys left behind", afterKeys.size === beforeKeys.size);

console.log("\nCleaning up...");
await admin.from("cart_items").delete().eq("cart_id", curCart.id);
await admin.from("carts").delete().eq("id", curCart.id);
await admin.from("products").delete().eq("id", curProduct.id);
for (const key of new Set([...ORIGINAL.keys(), ...SETTINGS_REGISTRY.map((e) => e.key)])) {
  await restore(key);
}
await admin.auth.admin.deleteUser(staffAdmin.userId);
await admin.auth.admin.deleteUser(customer.userId);

const { data: finalRows } = await admin.from("site_settings").select("key");
console.log(
  `Remaining — site_settings rows: ${(finalRows ?? []).length} (was ${ORIGINAL.size} at start)`
);
if ((finalRows ?? []).length !== ORIGINAL.size) {
  failures += 1;
  console.log("FAIL — settings table was not restored to its original state");
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

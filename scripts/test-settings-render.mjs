import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const APP_URL = process.env.TEST_APP_URL ?? "http://localhost:3000";

// store.announcement_enabled / store.announcement_text are gone as of
// Module 19 Pass 2 — the single site_settings announcement toggle was
// replaced by the scheduled promotional_banners table, whose rendering is
// covered by scripts/test-marketing-pass2.mjs instead.
const testRows = [
  { key: "seo.default_title", value: "Module3TestTitle" },
  { key: "store.contact_email", value: "module3-test@example.com" },
];

console.log("Writing test rows via service role...");
const { error: writeErr } = await admin.from("site_settings").upsert(testRows);
if (writeErr) throw writeErr;

// Give getSiteSettings() (uncached across requests) a fresh fetch.
const resp = await fetch(APP_URL + "/");
const html = await resp.text();

const checks = [
  // KNOWN PRE-EXISTING FAILURE (not caused by Module 19): the homepage's own
  // generateMetadata returns `title: settings.homepage.seoTitle ?? undefined`,
  // and an explicit `undefined` OVERRIDES the root layout's title.default in
  // Next.js rather than inheriting it — so with homepage.seo_title unset the
  // page renders NO <title> tag at all. Verified against a clean checkout with
  // this module's changes stashed. Belongs to the SEO module, not here.
  ["title reflects seo.default_title", html.includes("Module3TestTitle")],
  ["footer contact email renders", html.includes("module3-test@example.com")],
];

for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}`);
}

console.log("\nCleaning up test rows...");
const { error: cleanupErr } = await admin
  .from("site_settings")
  .delete()
  .in(
    "key",
    testRows.map((r) => r.key)
  );
if (cleanupErr) throw cleanupErr;

const { data: remaining } = await admin.from("site_settings").select("key");
console.log(`site_settings rows remaining: ${remaining.length} (should be 0)`);

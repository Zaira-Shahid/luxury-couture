import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const APP_URL = process.env.TEST_APP_URL ?? "http://localhost:3000";

const testRows = [
  { key: "store.announcement_enabled", value: true },
  { key: "store.announcement_text", value: "Module 3 test announcement — free worldwide shipping" },
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
  ["title reflects seo.default_title", html.includes("Module3TestTitle")],
  ["announcement bar text renders", html.includes("Module 3 test announcement")],
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

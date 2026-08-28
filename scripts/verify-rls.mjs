import { createClient } from "@supabase/supabase-js";

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check(label, expect, fn) {
  const res = await fn();
  const rowCount = res.data?.length ?? 0;
  const pass =
    expect === "some rows"
      ? !res.error && rowCount > 0
      : expect === "empty, no error"
        ? !res.error && rowCount === 0
        : expect === "error"
          ? !!res.error
          : false;
  console.log(
    `${pass ? "PASS" : "FAIL"} — ${label} (expected: ${expect}): status=${res.status}, rows=${rowCount}${res.error ? `, error="${res.error.message}"` : ""}`
  );
}

// Public read paths — an anonymous visitor should see active/published
// data (grant now exists; RLS should still correctly scope to is_active).
await check("anon reads active fabrics", "some rows", () =>
  anon.from("fabrics").select("*").eq("is_active", true)
);
await check("anon reads categories", "some rows", () =>
  anon.from("categories").select("*")
);

// site_settings is deliberately public-read (migration 0019, Module 3):
// branding, theme, the announcement bar and the SEO defaults have to
// render for every visitor, not just admins. This assertion used to
// expect an empty result and only passed while the table happened to
// hold no rows — the homepage imagery keys made that accidental pass
// visible. What matters is enforced below and in test-settings-pass1:
// the table holds no credentials, and anonymous writes are rejected.
await check("anon reads site_settings (public config by design)", "some rows", () =>
  anon.from("site_settings").select("*")
);

// Owner/admin-only paths — grant now exists, so these must come back as a
// clean *empty result* (RLS filtering), not a permission-denied error.
await check("anon reads profiles (owner/admin-only)", "empty, no error", () =>
  anon.from("profiles").select("*")
);
await check("anon reads audit_logs (admin-only)", "empty, no error", () =>
  anon.from("audit_logs").select("*")
);
await check("anon reads orders (owner/admin-only)", "empty, no error", () =>
  anon.from("orders").select("*")
);
await check(
  "anon reads schema_migrations (admin-only, new in 0014)",
  "empty, no error",
  () => anon.from("schema_migrations").select("*")
);

// Anonymous write to an admin-managed table should be rejected by RLS
// (grant exists now, so this must be a policy rejection, not 42501).
await check("anon cannot insert into fabrics", "error", () =>
  anon.from("fabrics").insert({ name: "Hijacked", slug: `hijacked-${Date.now()}` })
);
await check("anon cannot write site_settings", "error", () =>
  anon.from("site_settings").upsert({ key: "seo.default_title", value: "Hijacked" })
);

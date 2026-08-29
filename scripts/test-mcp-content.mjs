// Module 40 — the MCP content and SEO tools.
//
// This suite's weight sits on three things:
//
//  1. 12B.12 CANNOT BE BROKEN BY AN ARGUMENT. AI-drafted copy must never
//     be published automatically and must always be marked. The tool
//     takes neither a `status` nor an `ai_generated` parameter, so the
//     rule is enforced by absence rather than by a check somebody can
//     forget. Asserted at the schema, at the source, and against the row.
//
//  2. THE SETTINGS NAMESPACE IS A BOUNDARY. `site_settings` holds
//     currency, theme colours and notification switches beside the SEO
//     defaults. The SEO tools fix the `seo.*` keys and accept only
//     values, so no argument can reach another namespace — 12B.15's "no
//     tool takes a table name", applied to keys. Checked by trying.
//
//  3. INDEXING IS SEPARATE AND CONFIRMED. Blocking search engines
//     delists the whole site, so it is its own high-risk tool rather than
//     a field on the editor. This script SETS AND RESTORES it: leaving it
//     blocked would silently break the storefront and every later SEO
//     script, so the original value is captured first and put back in the
//     cleanup regardless of what fails.
//
//   node --env-file=.env.local scripts/test-mcp-content.mjs
//
// Requires a running PRODUCTION server (APP_URL, default localhost:3000).
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { purgeDevtestData } from "./lib/purge-devtest.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;
function check(label, ok) {
  if (ok) {
    passed += 1;
    console.log(`PASS — ${label}`);
  } else {
    failed += 1;
    console.log(`FAIL — ${label}`);
  }
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** The nine tools this module adds. All content.write. */
// Permission per tool is the interesting column: it is what the TABLE
// requires under migration 0054, not what the admin route requires. The
// two disagree for SEO settings and for banners, and a tool that
// declared the route's key would be offered to a role RLS then refuses.
const TOOLS = {
  content_get_homepage: { kind: "read", risk: "low", permission: "content.write" },
  content_list_banners: { kind: "read", risk: "low", permission: "marketing.write" },
  content_create_banner: { kind: "write", risk: "medium", permission: "marketing.write" },
  content_update_banner: { kind: "write", risk: "medium", permission: "marketing.write" },
  content_set_banner_active: { kind: "write", risk: "high", permission: "marketing.write" },
  content_draft_blog_post: { kind: "write", risk: "medium", permission: "content.write" },
  seo_get_settings: { kind: "read", risk: "low", permission: "content.write" },
  seo_update_settings: { kind: "write", risk: "medium", permission: "settings.manage" },
  seo_set_indexing: { kind: "write", risk: "high", permission: "settings.manage" },
  seo_update_override: { kind: "write", risk: "medium", permission: "content.write" },
};

// =====================================================================
console.log("# Part A — the invariants, asserted at the source");
// =====================================================================

const migration = readFileSync("supabase/migrations/0064_ai_generated_content.sql", "utf8");
// Nullable would make every pre-existing post an open question rather
// than a person's work.
check(
  "the AI marking is not nullable and defaults to false",
  /ai_generated boolean not null default false/.test(migration)
);
check("both content tables are marked", /alter table public\.blog_posts/.test(migration) && /alter table public\.pages/.test(migration));
check("when it was drafted is recorded separately from when the row appeared", /ai_generated_at timestamptz/.test(migration));

const writeContent = readFileSync("src/lib/content/write-content.ts", "utf8");
// The enforcement of 12B.12 is that these are literals, not parameters.
check('the draft service hard-codes status: "draft"', /status: "draft",/.test(writeContent));
check("the draft service hard-codes ai_generated: true", /ai_generated: true,/.test(writeContent));
// Scoped to the type BLOCK. A lazy match across the whole file finds
// the words in the prose above, which says why they are absent.
const draftInputBlock = /BlogDraftInput = \{([^}]*)\}/.exec(writeContent)?.[1] ?? "";
check(
  "the draft input type offers neither status nor a marking field",
  draftInputBlock.length > 0 && !/status|aiGenerated|ai_generated/.test(draftInputBlock)
);
check(
  "nothing in the content services calls an LLM — the caller is the author",
  !/anthropic|openai|messages\.create/i.test(writeContent)
);

const contentTools = readFileSync("src/lib/mcp/tools/content-write.ts", "utf8");
check("no content tool passes isActive to the create or update service", !/isActive: (input|true)/.test(contentTools));

const writeSeo = readFileSync("src/lib/seo/write-seo.ts", "utf8");
// A service that took a key would be a tool that could rewrite currency,
// theme colours or the notification switches.
check("the SEO service fixes its keys rather than accepting one", /const SEO_KEYS = \{/.test(writeSeo));
check("every key the SEO service writes is in the seo namespace", (writeSeo.match(/"seo\.[a-z_]+"/g) ?? []).length >= 6);
check("indexing is its own service function, not a field on the editor", /export async function setIndexingEnabled/.test(writeSeo));
const seoKeysBlock = /SEO_KEYS = \{([^}]*)\}/.exec(writeSeo)?.[1] ?? "";
check(
  "the SEO defaults service does not write the indexing key",
  seoKeysBlock.length > 0 && !/indexing/.test(seoKeysBlock)
);

for (const [name, source] of [
  ["src/lib/content/write-content.ts", writeContent],
  ["src/lib/seo/write-seo.ts", writeSeo],
]) {
  check(`${name} takes an explicit client rather than building one from cookies`, !source.includes("supabase/server"));
  check(`${name} does not redirect — that throws, and MCP has no page to catch it`, !/^\s*redirect\(/m.test(source));
  check(`${name} does not revalidate — the cache is the caller's concern`, !/^\s*(await )?revalidatePath\(/m.test(source));
}

// =====================================================================
console.log("\n# Part B — the live endpoint, with real accounts");
// =====================================================================

const suffix = Date.now();
const createdUsers = [];
const createdBanners = [];
const createdPosts = [];
await purgeDevtestData(admin);

// Captured BEFORE anything runs and restored in the cleanup. Leaving
// indexing blocked would delist the storefront and break every later SEO
// script in the suite.
const { data: indexingBefore } = await admin
  .from("site_settings")
  .select("value")
  .eq("key", "seo.indexing_enabled")
  .maybeSingle();
const originalIndexing = indexingBefore?.value;

async function restoreIndexing() {
  if (originalIndexing === undefined) {
    await admin.from("site_settings").delete().eq("key", "seo.indexing_enabled");
  } else {
    await admin
      .from("site_settings")
      .upsert({ key: "seo.indexing_enabled", value: originalIndexing }, { onConflict: "key" });
  }
}

async function actor(role) {
  const email = `m40-${role}-${suffix}@luxury-couture-devtest.local`;
  const password = `m40-test-${role}-${suffix}`;
  const { data: user, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${role}) failed: ${error.message}`);
  if (role !== "customer") {
    const { error: roleErr } = await admin.from("profiles").update({ role }).eq("id", user.user.id);
    if (roleErr) throw new Error(`role assign(${role}) failed: ${roleErr.message}`);
  }

  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: session, error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn(${role}) failed: ${signInErr.message}`);

  createdUsers.push(user.user.id);
  return { id: user.user.id, email, role, session: session.session };
}

const actors = {
  super_admin: await actor("super_admin"),
  // marketing HOLDS content.write — the allowed role for this module,
  // where in Module 38 it was the refused one.
  marketing: await actor("marketing"),
  sales: await actor("sales"),
  production: await actor("production"),
  customer: await actor("customer"),
};

async function rpc(who, body) {
  const headers = { "content-type": "application/json" };
  if (who) headers.authorization = `Bearer ${who.session.access_token}`;
  const res = await fetch(`${APP_URL}/api/mcp`, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* left null — the check that cares will fail on it */
  }
  return { status: res.status, json, text };
}

const call = (who, name, args = {}) =>
  rpc(who, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });

const structured = async (who, name, args) => (await call(who, name, args)).json?.result?.structuredContent ?? null;

async function confirmAndRun(who, name, args) {
  const proposal = await structured(who, name, args);
  if (proposal?.status !== "CONFIRMATION_REQUIRED") return { proposal, executed: null };
  const executed = await structured(who, name, {
    ...args,
    confirmationToken: proposal.confirmationToken,
  });
  return { proposal, executed, token: proposal.confirmationToken };
}

const bannerRow = (id) => admin.from("promotional_banners").select("*").eq("id", id).maybeSingle();
const settingValue = async (key) =>
  (await admin.from("site_settings").select("value").eq("key", key).maybeSingle()).data?.value;

// ---- Registration ----------------------------------------------------
console.log("\n## Registration");

const list = await rpc(actors.super_admin, { jsonrpc: "2.0", id: 1, method: "tools/list" });
const listed = list.json?.result?.tools ?? [];
const byName = new Map(listed.map((t) => [t.name, t]));

check("tools/list still renders — no schema in this module is unrepresentable", listed.length > 0);

for (const [name, { kind, risk, permission }] of Object.entries(TOOLS)) {
  const tool = byName.get(name);
  check(`${name} is registered`, Boolean(tool));
  check(`${name} declares ${permission}`, tool?._meta?.permission === permission);
  check(`${name} is a ${kind} tool`, tool?._meta?.kind === kind);
  check(`${name} is ${risk} risk`, tool?._meta?.risk === risk);
  check(
    `${name} ${risk === "high" ? "requires" : "does not require"} confirmation`,
    tool?._meta?.confirmationRequired === (risk === "high")
  );
  check(
    `${name} describes what it refuses to do`,
    /cannot|does not|never|nothing|leaves? .* unchanged|reads only|separate list/i.test(tool?.description ?? "")
  );
  check(`${name} advertises a JSON schema`, tool?.inputSchema?.type === "object");
}

// The rule of 12B.12, asserted where a model would look for the loophole.
const draftSchema = byName.get("content_draft_blog_post")?.inputSchema?.properties ?? {};
check("the draft tool advertises no status field", !("status" in draftSchema));
check("the draft tool advertises no ai_generated field", !("aiGenerated" in draftSchema) && !("ai_generated" in draftSchema));
check("the draft tool advertises no publishedAt field", !("publishedAt" in draftSchema));

const bannerEditorSchema = byName.get("content_update_banner")?.inputSchema?.properties ?? {};
check("the banner editor advertises no active field", !("active" in bannerEditorSchema) && !("isActive" in bannerEditorSchema));

const seoEditorSchema = byName.get("seo_update_settings")?.inputSchema?.properties ?? {};
check("the SEO editor advertises no indexing field", !("indexingEnabled" in seoEditorSchema) && !("enabled" in seoEditorSchema));
check("the SEO editor advertises no settings key field", !("key" in seoEditorSchema));

// ---- Authorization ---------------------------------------------------
console.log("\n## Authorization (content.write, and only content.write)");

async function refusalCode(who, name, args = {}) {
  const res = await call(who, name, args);
  return res.json?.error?.data?.code ?? res.json?.result?.structuredContent?.errorCode ?? null;
}

const REFUSED = ["FORBIDDEN", "UNAUTHORIZED"];

for (const name of Object.keys(TOOLS)) {
  for (const role of ["sales", "production", "customer"]) {
    check(`${role} is refused ${name}`, REFUSED.includes(await refusalCode(actors[role], name)));
  }
}

// The readers are gated too: there is no content.read key, so reading
// takes the same permission as changing.
check(
  "a role without content.write cannot even READ the homepage content",
  REFUSED.includes(await refusalCode(actors.sales, "content_get_homepage"))
);

// THE MISMATCH THIS MODULE FOUND. marketing holds content.write and
// marketing.write but NOT settings.manage, so it can draft a post and
// run the banners while the site-wide SEO settings stay out of reach.
// Declaring content.write on those two would have listed them for
// marketing and had RLS refuse every call.
check(
  "marketing is refused seo_update_settings — site_settings needs settings.manage",
  REFUSED.includes(await refusalCode(actors.marketing, "seo_update_settings"))
);
check(
  "marketing is refused seo_set_indexing for the same reason",
  REFUSED.includes(await refusalCode(actors.marketing, "seo_set_indexing"))
);
check(
  "marketing CAN reach the content tools it holds the key for",
  !REFUSED.includes(await refusalCode(actors.marketing, "content_get_homepage"))
);

const refusedCount = (await admin.from("promotional_banners").select("id", { count: "exact", head: true })).count;
await structured(actors.sales, "content_create_banner", { text: `m40 forbidden ${suffix}` });
const afterRefused = (await admin.from("promotional_banners").select("id", { count: "exact", head: true })).count;
check("a refused create wrote nothing to the database", refusedCount === afterRefused);

// ---- Reading ---------------------------------------------------------
console.log("\n## content_get_homepage");

const homepage = await structured(actors.marketing, "content_get_homepage");
check("marketing can read the homepage content", homepage?.status === "SUCCESS");
check("it returns the hero fields", "heroHeading" in (homepage?.data?.homepage ?? {}));
check("it does NOT carry the banner list — that needs a stricter key", !("banners" in (homepage?.data ?? {})));

const bannerList = await structured(actors.marketing, "content_list_banners");
check("marketing can list the banners", bannerList?.status === "SUCCESS");
check("the banner list is a list", Array.isArray(bannerList?.data?.banners));

const seoRead = await structured(actors.marketing, "seo_get_settings");
check("marketing can read the SEO settings", seoRead?.status === "SUCCESS");
check("it reports whether indexing is allowed", typeof seoRead?.data?.indexingEnabled === "boolean");

// ---- Banners ---------------------------------------------------------
console.log("\n## Banners");

const created = await structured(actors.marketing, "content_create_banner", {
  text: `M40 banner ${suffix}`,
  linkUrl: "https://example.com/m40",
});
check("content_create_banner succeeds", created?.status === "SUCCESS");
const bannerId = created?.data?.id ?? null;
if (bannerId) createdBanners.push(bannerId);
check("a created banner is HIDDEN — creating one publishes nothing", (await bannerRow(bannerId)).data?.is_active === false);

await structured(actors.marketing, "content_update_banner", {
  id: bannerId,
  text: `M40 banner edited ${suffix}`,
});
const edited = (await bannerRow(bannerId)).data;
check("the edited field changed", edited?.text === `M40 banner edited ${suffix}`);
check("the field NOT sent survived", edited?.link_url === "https://example.com/m40");
check("editing did not switch the banner on", edited?.is_active === false);

check(
  "the editor refuses an active field it never advertised",
  (await structured(actors.marketing, "content_update_banner", { id: bannerId, isActive: true }))?.errorCode ===
    "VALIDATION_ERROR"
);
check("the banner is still hidden after that attempt", (await bannerRow(bannerId)).data?.is_active === false);

const showRun = await confirmAndRun(actors.marketing, "content_set_banner_active", {
  id: bannerId,
  active: true,
});
check("showing a banner requires confirmation", showRun.proposal?.status === "CONFIRMATION_REQUIRED");
check("the proposal QUOTES the banner text rather than its id", (showRun.proposal?.summary ?? "").includes("M40 banner edited"));
check("the confirmed call shows it", showRun.executed?.status === "SUCCESS");
check("the banner is now visible", (await bannerRow(bannerId)).data?.is_active === true);

const alreadyShown = await structured(actors.marketing, "content_set_banner_active", {
  id: bannerId,
  active: true,
});
check("showing an already-visible banner reports no affected records", alreadyShown?.affectedRecords === 0);

const hideRun = await confirmAndRun(actors.marketing, "content_set_banner_active", {
  id: bannerId,
  active: false,
});
check("hiding it works too", hideRun.executed?.status === "SUCCESS");
check("hiding deletes nothing — the row is still there", Boolean((await bannerRow(bannerId)).data));

// ---- AI drafting (12B.12) --------------------------------------------
console.log("\n## AI drafting — 12B.12");

const draft = await structured(actors.marketing, "content_draft_blog_post", {
  title: `M40 Bridal Guide ${suffix}`,
  slug: `m40-bridal-guide-${suffix}`,
  excerpt: "Drafted by the Module 40 suite.",
  content: "Body copy.",
});
check("content_draft_blog_post succeeds", draft?.status === "SUCCESS");
const postId = draft?.data?.id ?? null;
if (postId) createdPosts.push(postId);

const { data: post } = await admin
  .from("blog_posts")
  .select("status, ai_generated, ai_generated_at, published_at")
  .eq("id", postId)
  .maybeSingle();
check("the post is a DRAFT", post?.status === "draft");
check("the post is MARKED as AI-generated", post?.ai_generated === true);
check("when it was drafted is recorded", Boolean(post?.ai_generated_at));
check("it has no publish date", post?.published_at === null);
check("the result tells the caller it is an unpublished draft", draft?.data?.status === "draft");

// The loophole hunt: every shape a model might reach for to publish.
for (const [label, args] of [
  ["status", { status: "published" }],
  ["publishedAt", { publishedAt: new Date().toISOString() }],
  ["aiGenerated", { aiGenerated: false }],
  ["ai_generated", { ai_generated: false }],
]) {
  const res = await structured(actors.marketing, "content_draft_blog_post", {
    title: `M40 loophole ${label} ${suffix}`,
    slug: `m40-loophole-${label.toLowerCase()}-${suffix}`,
    ...args,
  });
  check(`a draft call carrying ${label} is refused`, res?.errorCode === "VALIDATION_ERROR");
}

const { count: publishedByAi } = await admin
  .from("blog_posts")
  .select("id", { count: "exact", head: true })
  .eq("ai_generated", true)
  .eq("status", "published");
check("no AI-generated post is published anywhere in the database", (publishedByAi ?? 0) === 0);

check(
  "a duplicate slug is refused rather than overwriting a post",
  (await structured(actors.marketing, "content_draft_blog_post", {
    title: "Duplicate",
    slug: `m40-bridal-guide-${suffix}`,
  }))?.status === "FAILED"
);

// ---- SEO -------------------------------------------------------------
console.log("\n## SEO settings");

const titleBefore = await settingValue("seo.default_title");
const descBefore = await settingValue("seo.default_description");

await structured(actors.super_admin, "seo_update_settings", {
  defaultTitle: `M40 Title ${suffix}`,
});
check("the field sent was written", (await settingValue("seo.default_title")) === `M40 Title ${suffix}`);
check("the field NOT sent survived — omission is not deletion", (await settingValue("seo.default_description")) === descBefore);

await structured(actors.super_admin, "seo_update_settings", { twitterHandle: `m40handle` });
check("a handle typed without @ is corrected rather than refused", (await settingValue("seo.twitter_handle")) === "@m40handle");

check(
  "an empty update is refused rather than silently succeeding",
  (await structured(actors.super_admin, "seo_update_settings", {}))?.errorCode === "BUSINESS_RULE_ERROR"
);
check(
  "the editor refuses an arbitrary settings key",
  (await structured(actors.super_admin, "seo_update_settings", { key: "store.currency", value: "USD" }))
    ?.errorCode === "VALIDATION_ERROR"
);
check("the currency setting is untouched by that attempt", (await settingValue("store.currency")) !== "USD");

console.log("\n## Indexing is its own confirmed tool");

// This project's default is NOT indexed — DEFAULT_SITE_SETTINGS.seo
// .indexingEnabled is false, which is right for a site that has not
// launched. So indexing is switched ON first, and only then blocked:
// asserting the block from an unknown starting state would have passed
// on "it was already blocked, nothing happened".
const enableRun = await confirmAndRun(actors.super_admin, "seo_set_indexing", { enabled: true });
check("allowing indexing requires confirmation too", enableRun.proposal?.status === "CONFIRMATION_REQUIRED");
check("the confirmed call allows indexing", enableRun.executed?.status === "SUCCESS");
check("indexing is now allowed", (await settingValue("seo.indexing_enabled")) === true);

const indexRun = await confirmAndRun(actors.super_admin, "seo_set_indexing", { enabled: false });
check("blocking indexing requires confirmation", indexRun.proposal?.status === "CONFIRMATION_REQUIRED");
check("the proposal says the whole site drops out of search", /whole site|every page/i.test(indexRun.proposal?.summary ?? ""));
check("the confirmed call blocks indexing", indexRun.executed?.status === "SUCCESS");
check("indexing is now blocked", (await settingValue("seo.indexing_enabled")) === false);
check("the result reports what it was before", indexRun.executed?.data?.previous === true);

// An absent row must read as the default, not as "enabled". Getting this
// wrong makes the confirmation prompt describe a change that is not the
// one about to happen.
await admin.from("site_settings").delete().eq("key", "seo.indexing_enabled");
const fromAbsent = await structured(actors.super_admin, "seo_set_indexing", { enabled: false });
check(
  "with no stored value the tool reports the site default, not a guess",
  /already blocked/i.test(fromAbsent?.summary ?? "")
);

console.log("\n## SEO overrides");

const { data: someProduct } = await admin.from("products").select("id").limit(1).maybeSingle();
if (someProduct) {
  await structured(actors.marketing, "seo_update_override", {
    entityType: "product",
    entityId: someProduct.id,
    metaTitle: `M40 Meta ${suffix}`,
    metaDescription: `M40 Description ${suffix}`,
  });
  await structured(actors.marketing, "seo_update_override", {
    entityType: "product",
    entityId: someProduct.id,
    metaTitle: `M40 Meta Edited ${suffix}`,
  });
  const { data: override } = await admin
    .from("seo_metadata")
    .select("meta_title, meta_description")
    .eq("entity_type", "product")
    .eq("entity_id", someProduct.id)
    .maybeSingle();
  check("the override field sent was changed", override?.meta_title === `M40 Meta Edited ${suffix}`);
  check("the override field NOT sent survived", override?.meta_description === `M40 Description ${suffix}`);
} else {
  check("the override field sent was changed", false);
  check("the override field NOT sent survived", false);
}

check(
  "an entity type outside the four allowed is refused",
  (await structured(actors.marketing, "seo_update_override", {
    entityType: "profiles",
    entityId: "00000000-0000-0000-0000-000000000000",
    metaTitle: "x",
  }))?.errorCode === "VALIDATION_ERROR"
);
for (const table of ["site_settings", "profiles", "orders"]) {
  check(
    `seo_update_override refuses the table name "${table}"`,
    (await structured(actors.marketing, "seo_update_override", {
      entityType: table,
      entityId: "00000000-0000-0000-0000-000000000000",
      metaTitle: "x",
    }))?.errorCode === "VALIDATION_ERROR"
  );
}

// ---- Validation and leakage -----------------------------------------
console.log("\n## Validation and secret leakage");

check(
  "an unknown field is refused (schemas are strict)",
  (await structured(actors.marketing, "content_create_banner", { text: "x", table: "profiles" }))?.errorCode ===
    "VALIDATION_ERROR"
);
check(
  "an empty banner text is refused — it would show an empty bar to everyone",
  (await structured(actors.marketing, "content_create_banner", { text: "   " }))?.errorCode === "VALIDATION_ERROR"
);
check(
  "a malformed slug is refused",
  (await structured(actors.marketing, "content_draft_blog_post", { title: "x", slug: "Not A Slug!" }))
    ?.errorCode === "VALIDATION_ERROR"
);
check(
  "a missing banner is NOT_FOUND, not a silent success",
  (await structured(actors.marketing, "content_update_banner", {
    id: "00000000-0000-0000-0000-000000000000",
    text: "x",
  }))?.status === "FAILED"
);

const everythingSeen = JSON.stringify([homepage, bannerList, seoRead, created, draft, showRun, indexRun]);
check("no service-role key appears in any result", !everythingSeen.includes(serviceKey));
check("no anon key appears in any result", !everythingSeen.includes(anonKey));
check("no connection string appears in any result", !/postgres(ql)?:\/\//.test(everythingSeen));
check("no settings key is echoed back to the caller", !/site_settings|promotional_banners|blog_posts/.test(everythingSeen));

// ---- Cleanup ---------------------------------------------------------
// Indexing first, and unconditionally: everything else is test data, but
// a site left un-indexed is a live problem.
await restoreIndexing();
if (titleBefore === undefined) {
  await admin.from("site_settings").delete().eq("key", "seo.default_title");
} else {
  await admin.from("site_settings").upsert({ key: "seo.default_title", value: titleBefore }, { onConflict: "key" });
}
await admin.from("site_settings").delete().eq("key", "seo.twitter_handle");
if (createdBanners.length) await admin.from("promotional_banners").delete().in("id", createdBanners);
await admin.from("blog_posts").delete().like("slug", `%${suffix}`);
await purgeDevtestData(admin);
for (const id of createdUsers) {
  await admin.auth.admin.deleteUser(id).catch(() => {});
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

// Module 20 Pass 2 — content management, admin SEO, routing safety.
//
// Requires the dev server running (npm run dev) and .env.local loaded:
//   node --env-file=.env.local scripts/test-seo-pass2.mjs
//
// Covers: published-vs-draft visibility for posts/pages/FAQs (including
// RLS, not just query filters), the root-level CMS route not shadowing
// real storefront routes, FAQPage/BlogPosting structured data, footer
// internal linking, admin content/SEO route authorization, and the
// per-entity SEO override path for pages and posts.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const suffix = Date.now();

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

function projectRef() {
  return new URL(url).hostname.split(".")[0];
}
function sessionCookieHeader(session) {
  const b64url = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `sb-${projectRef()}-auth-token=base64-${b64url}`;
}

async function get(path, cookie) {
  const res = await fetch(`${appUrl}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  return { status: res.status, html: await res.text() };
}

function jsonLdBlocks(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1].replace(/\\u003c/g, "<")));
    } catch {
      blocks.push({ __parseError: true });
    }
  }
  return blocks;
}
const findSchema = (blocks, type) => blocks.find((b) => b["@type"] === type);

function metaContent(html, key) {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)="${key}"[^>]*>`, "i"))?.[0];
  return tag?.match(/content="([^"]*)"/i)?.[1] ?? null;
}

// NOTE on assertion scope. Module 19's script narrowed checks to the
// rendered <tbody> because dev-mode Next.js embeds raw, *unfiltered*
// server fetch responses in the RSC flight payload, so a whole-document
// check could report a filtered-away row as present. That narrowing does
// NOT translate to these pages: with streaming, `<main>` is emitted
// nearly empty (~100 bytes) and the real content arrives later in the
// flight payload, so a <main> slice would be empty and every positive
// check would fail for the wrong reason.
//
// Whole-document checks are the correct tool here because every content
// fetcher in lib/content/get-content.ts filters at the QUERY level
// (`status = 'published'` / `is_active`), so a draft row is never fetched
// and therefore can never appear in the payload at all. The one page that
// does fetch-then-filter in JS is /admin/seo — its negative check below
// asserts on a `value="..."` attribute, which only exists in rendered
// markup and never in the JSON-encoded payload.

console.log("=== Setup: admin + customer, published and draft content of each kind ===");
const staffAdmin = await signIn(`m20-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-c0");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);
const customer = await signIn(`m20-cust-${suffix}@luxury-couture-devtest.local`, "correct-horse-c1");

await admin
  .from("site_settings")
  .upsert({ key: "seo.indexing_enabled", value: true }, { onConflict: "key" });

const { data: livePost } = await admin
  .from("blog_posts")
  .insert({
    title: `Live Post ${suffix}`,
    slug: `live-post-${suffix}`,
    excerpt: "A published post excerpt.",
    content: "First paragraph.\n\nSecond paragraph.",
    status: "published",
    published_at: new Date().toISOString(),
  })
  .select()
  .single();

const { data: draftPost } = await admin
  .from("blog_posts")
  .insert({
    title: `Draft Post ${suffix}`,
    slug: `draft-post-${suffix}`,
    content: "Should never be public.",
    status: "draft",
  })
  .select()
  .single();

const { data: livePage } = await admin
  .from("pages")
  .insert({
    title: `Live Page ${suffix}`,
    slug: `live-page-${suffix}`,
    content: "About us body copy.",
    status: "published",
  })
  .select()
  .single();

const { data: draftPage } = await admin
  .from("pages")
  .insert({
    title: `Draft Page ${suffix}`,
    slug: `draft-page-${suffix}`,
    content: "Should never be public.",
    status: "draft",
  })
  .select()
  .single();

const { data: activeFaq } = await admin
  .from("faqs")
  .insert({
    question: `How long does a bespoke order take ${suffix}?`,
    answer: "Typically 8-12 weeks from confirmed measurements.",
    category: "Ordering",
    sort_order: 0,
    is_active: true,
  })
  .select()
  .single();

const { data: inactiveFaq } = await admin
  .from("faqs")
  .insert({
    question: `Hidden question ${suffix}?`,
    answer: "Should never be public.",
    is_active: false,
    sort_order: 1,
  })
  .select()
  .single();

console.log("\n=== Blog: published renders, draft 404s ===");
const livePostRes = await get(`/blog/${livePost.slug}`);
check("published post returns 200", livePostRes.status === 200);
check("post title renders", livePostRes.html.includes(livePost.title));
check("post body paragraphs render", livePostRes.html.includes("Second paragraph."));
const draftPostRes = await get(`/blog/${draftPost.slug}`);
check("draft post 404s for an anonymous visitor", draftPostRes.status === 404);

const blogIndex = await get("/blog");
check("blog index returns 200", blogIndex.status === 200);
check("index lists the published post", blogIndex.html.includes(livePost.title));
check("index does NOT list the draft post", !blogIndex.html.includes(draftPost.title));

console.log("\n=== Blog: BlogPosting structured data ===");
const postBlocks = jsonLdBlocks(livePostRes.html);
const posting = findSchema(postBlocks, "BlogPosting");
check("every JSON-LD block parses", postBlocks.every((b) => !b.__parseError));
check("emits BlogPosting", Boolean(posting));
check("headline matches", posting?.headline === livePost.title);
check("datePublished present", Boolean(posting?.datePublished));
check("mainEntityOfPage is absolute", String(posting?.mainEntityOfPage?.["@id"] ?? "").startsWith("http"));
check("og:type is article", metaContent(livePostRes.html, "og:type") === "article");
check("breadcrumb has 3 levels", findSchema(postBlocks, "BreadcrumbList")?.itemListElement?.length === 3);

console.log("\n=== CMS pages at the root ===");
const livePageRes = await get(`/${livePage.slug}`);
check("published page returns 200", livePageRes.status === 200);
check("page title renders", livePageRes.html.includes(livePage.title));
check("page body renders", livePageRes.html.includes("About us body copy."));
const draftPageRes = await get(`/${draftPage.slug}`);
check("draft page 404s for an anonymous visitor", draftPageRes.status === 404);
const missingRes = await get(`/definitely-not-a-page-${suffix}`);
check("an unknown root slug 404s", missingRes.status === 404);

console.log("\n=== A CMS page can never shadow a real storefront route ===");
// Insert straight through the service role, bypassing the app's own
// reserved-slug validation, to prove the ROUTER (not just validation)
// keeps static segments winning.
const { data: shadowPage } = await admin
  .from("pages")
  .insert({
    title: "Shadow Attempt",
    slug: "products",
    content: "If you can see this, the CMS route hijacked /products.",
    status: "published",
  })
  .select()
  .single();

const productsRes = await get("/products");
check("/products still returns 200", productsRes.status === 200);
check(
  "/products renders the catalog, not the CMS page",
  !productsRes.html.includes("the CMS route hijacked")
);
check("/products still shows the Shop heading", productsRes.html.includes("Shop"));
const cartRes = await get("/cart");
check("/cart is unaffected by the catch-all", cartRes.status === 200);

console.log("\n=== FAQ page and FAQPage schema ===");
const faqRes = await get("/faq");
check("/faq returns 200", faqRes.status === 200);
check("active FAQ question renders", faqRes.html.includes(activeFaq.question));
check("inactive FAQ does NOT render", !faqRes.html.includes(inactiveFaq.question));
const faqSchema = findSchema(jsonLdBlocks(faqRes.html), "FAQPage");
check("emits FAQPage", Boolean(faqSchema));
check(
  "FAQPage includes the active question",
  faqSchema?.mainEntity?.some((q) => q.name === activeFaq.question) === true
);
check(
  "FAQPage excludes the inactive question",
  faqSchema?.mainEntity?.every((q) => q.name !== inactiveFaq.question) === true
);
check(
  "answers are wrapped as acceptedAnswer",
  faqSchema?.mainEntity?.[0]?.acceptedAnswer?.["@type"] === "Answer"
);

console.log("\n=== Sitemap includes published content and excludes drafts ===");
const sitemap = await (await fetch(`${appUrl}/sitemap.xml`)).text();
check("lists the published post", sitemap.includes(`/blog/${livePost.slug}`));
check("lists the published page", sitemap.includes(`/${livePage.slug}`));
check("lists /blog and /faq", sitemap.includes("/blog<") && sitemap.includes("/faq<"));
check("omits the draft post", !sitemap.includes(draftPost.slug));
check("omits the draft page", !sitemap.includes(draftPage.slug));

console.log("\n=== Footer internal linking ===");
const home = await get("/");
check("footer links to /faq", home.html.includes('href="/faq"'));
check("footer links to /blog", home.html.includes('href="/blog"'));
check("footer links to the published CMS page", home.html.includes(`href="/${livePage.slug}"`));
check("footer does NOT link to the draft page", !home.html.includes(`href="/${draftPage.slug}"`));

console.log("\n=== RLS: anonymous clients cannot read drafts or write content ===");
const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: anonPosts } = await anon.from("blog_posts").select("id, status");
check(
  "anonymous select returns no draft posts",
  (anonPosts ?? []).every((p) => p.status === "published")
);
const { data: anonPages } = await anon.from("pages").select("id, status");
check(
  "anonymous select returns no draft pages",
  (anonPages ?? []).every((p) => p.status === "published")
);
const { data: anonFaqs } = await anon.from("faqs").select("id, is_active");
check("anonymous select returns no inactive FAQs", (anonFaqs ?? []).every((f) => f.is_active));

const { error: anonPageInsert } = await anon
  .from("pages")
  .insert({ title: "Hacked", slug: `hacked-${suffix}`, status: "published" });
check("anonymous INSERT into pages is rejected", Boolean(anonPageInsert));
const { error: anonFaqInsert } = await anon
  .from("faqs")
  .insert({ question: "Hacked?", answer: "Hacked." });
check("anonymous INSERT into faqs is rejected", Boolean(anonFaqInsert));
const { error: anonSeoInsert } = await anon
  .from("seo_metadata")
  .insert({ entity_type: "page", entity_id: livePage.id, meta_title: "Hacked" });
check("anonymous INSERT into seo_metadata is rejected", Boolean(anonSeoInsert));

console.log("\n=== RLS: a signed-in plain customer is equally blocked ===");
const { error: custPageInsert } = await customer.client
  .from("pages")
  .insert({ title: "Hacked", slug: `hacked-cust-${suffix}`, status: "published" });
check("customer INSERT into pages is rejected", Boolean(custPageInsert));
const { error: custFaqUpdate } = await customer.client
  .from("faqs")
  .update({ answer: "Tampered." })
  .eq("id", activeFaq.id);
const { data: faqAfter } = await admin.from("faqs").select("answer").eq("id", activeFaq.id).single();
check(
  "customer UPDATE of a FAQ changes nothing",
  Boolean(custFaqUpdate) || faqAfter.answer !== "Tampered."
);

console.log("\n=== Per-entity SEO overrides apply to pages and posts ===");
await admin.from("seo_metadata").insert([
  {
    entity_type: "page",
    entity_id: livePage.id,
    meta_title: `Page Override ${suffix}`,
    meta_description: `Page override description ${suffix}`,
  },
  {
    entity_type: "blog_post",
    entity_id: livePost.id,
    meta_title: `Post Override ${suffix}`,
  },
]);
const overriddenPage = await get(`/${livePage.slug}`);
check(
  "page override title wins",
  metaContent(overriddenPage.html, "og:title") === `Page Override ${suffix}`
);
check(
  "page override description wins",
  metaContent(overriddenPage.html, "og:description") === `Page override description ${suffix}`
);
const overriddenPost = await get(`/blog/${livePost.slug}`);
check(
  "post override title wins",
  metaContent(overriddenPost.html, "og:title") === `Post Override ${suffix}`
);

console.log("\n=== Admin routes: reachable by admin, blocked for a customer ===");
const adminCookie = sessionCookieHeader(staffAdmin.session);
const customerCookie = sessionCookieHeader(customer.session);
const adminRoutes = [
  "/admin/content",
  "/admin/content/posts/new",
  `/admin/content/posts/${livePost.id}/edit`,
  "/admin/content/pages/new",
  `/admin/content/pages/${livePage.id}/edit`,
  "/admin/content/faqs/new",
  `/admin/content/faqs/${activeFaq.id}/edit`,
  "/admin/seo",
];
for (const path of adminRoutes) {
  const res = await get(path, adminCookie);
  check(`admin can open ${path}`, res.status === 200);
}
for (const path of ["/admin/content", "/admin/seo"]) {
  const res = await get(path, customerCookie);
  check(`a plain customer is blocked from ${path}`, res.status !== 200);
}

const adminContent = await get("/admin/content", adminCookie);
check("admin content list shows the draft post", adminContent.html.includes(draftPost.title));
check("admin content list shows the draft page", adminContent.html.includes(draftPage.title));
check("admin content list shows the inactive FAQ", adminContent.html.includes(inactiveFaq.question));

const adminSeo = await get("/admin/seo", adminCookie);
// `value="<uuid>"` only ever appears in a rendered hidden input, never
// in the JSON-encoded flight payload — so this distinguishes "an override
// form was rendered for this entity" from "this row was merely fetched".
check(
  "admin SEO page renders an override form for the published page",
  adminSeo.html.includes(`value="${livePage.id}"`)
);
check(
  "admin SEO page renders NO override form for the draft page",
  !adminSeo.html.includes(`value="${draftPage.id}"`)
);

console.log("\nCleaning up...");
await admin.from("seo_metadata").delete().in("entity_id", [livePage.id, livePost.id]);
await admin.from("blog_posts").delete().in("id", [livePost.id, draftPost.id]);
await admin.from("pages").delete().in("id", [livePage.id, draftPage.id, shadowPage.id]);
await admin.from("faqs").delete().in("id", [activeFaq.id, inactiveFaq.id]);
await admin.from("site_settings").delete().eq("key", "seo.indexing_enabled");
await admin.auth.admin.deleteUser(staffAdmin.userId);
await admin.auth.admin.deleteUser(customer.userId);

const [{ data: rPosts }, { data: rPages }, { data: rFaqs }, { data: rSeo }, { data: rSettings }] =
  await Promise.all([
    admin.from("blog_posts").select("id"),
    admin.from("pages").select("id"),
    admin.from("faqs").select("id"),
    admin.from("seo_metadata").select("id"),
    admin.from("site_settings").select("key"),
  ]);
console.log(
  `Remaining — posts: ${rPosts.length}, pages: ${rPages.length}, faqs: ${rFaqs.length}, seo_metadata: ${rSeo.length}, settings: ${rSettings.length} (should reflect pre-existing state only)`
);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

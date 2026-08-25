// Module 22 — AI Foundation verification.
//
// Requires a running server (npm run build && npm run start) and
// .env.local loaded:
//   node --env-file=.env.local scripts/test-ai.mjs
//
// Structure: the pure logic (guardrails, FAQ matching, provider
// selection) is imported directly from the .ts sources — Node 24 strips
// types, and those three modules deliberately have NO imports so they can
// be tested exhaustively rather than only through a rendered page.
// Everything touching Supabase or Next is tested through the database and
// over HTTP.
import { createClient } from "@supabase/supabase-js";

import { applyGuardrails, guardedOrNull } from "../src/lib/ai/guardrails.ts";
import { matchFaq, tokenize } from "../src/lib/ai/faq-matching.ts";
import { selectProvider } from "../src/lib/ai/provider-selection.ts";

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

// ---------------------------------------------------------------------
console.log("=== GUARDRAILS: 'AI must never invent final prices' ===");
// The plan's hard rules are the reason this module needs a safety layer
// at all, so they get the most thorough coverage.
for (const [label, text] of [
  ["£ amount with comma", "This piece is £1,200 all in."],
  ["£ amount with pence", "It comes to £899.50."],
  ["$ amount", "Roughly $2,000 for the set."],
  ["€ amount", "About €1500."],
  ["currency code before", "The total is GBP 750."],
  ["currency code after", "That's 1200 GBP."],
  ["spelled-out currency", "Around 950 pounds for the lehenga."],
]) {
  const r = applyGuardrails(text);
  check(`price redacted — ${label}`, !r.clean && !/\d/.test(r.text.replace(/\[.*?\]/g, "")));
}

console.log("\n=== GUARDRAILS: 'must never promise delivery dates' ===");
for (const [label, text] of [
  ["within N weeks", "Your lehenga will arrive within 3 weeks."],
  ["in N days", "We deliver in 10 days."],
  ["range of weeks", "Ready in 8-12 weeks."],
  ["working days", "Dispatched within 5 working days."],
  ["by a weekday", "It will be ready by Friday."],
  ["on a date", "Shipping on 14 March."],
  ["month then day", "Delivered by March 20."],
  ["guarantee wording", "We guarantee delivery before your wedding."],
  // No determiner and no preposition — the two gaps this suite caught.
  ["bare weekday", "It will be ready by Friday."],
  ["no preposition at all", "Dispatched tomorrow."],
  ["over the weekend", "Delivered over the weekend."],
  ["bare plural period", "Ships in weeks."],
]) {
  const r = applyGuardrails(text);
  check(`date promise redacted — ${label}`, !r.clean);
}

console.log("\n=== GUARDRAILS: 'must never alter/claim order or payment state' ===");
for (const [label, text] of [
  ["order shipped", "Your order has shipped."],
  ["order delivered", "Your parcel has been delivered."],
  ["payment received", "Your payment was received."],
  ["payment processed", "Payment has been processed successfully."],
  ["refund issued", "Your refund has been issued."],
  ["deposit taken", "The deposit was taken this morning."],
]) {
  const r = applyGuardrails(text);
  check(`status claim redacted — ${label}`, !r.clean);
}

console.log("\n=== GUARDRAILS: must not mangle legitimate copy ===");
// A guardrail that redacts ordinary sentences is unusable, so the
// negative cases matter as much as the positive ones.
for (const [label, text] of [
  ["origin claim", "Hand-embroidered in Pakistan by our in-house artisans."],
  ["material detail", "Crafted from silk with zardozi embroidery and a scalloped hem."],
  ["process copy", "Every piece is made to order and tailored to your measurements."],
  ["consultation CTA", "Book a consultation to begin your custom design."],
  ["number that is not money", "The lehenga has 3 pieces: blouse, skirt and dupatta."],
  ["question about time", "How long does a bespoke order take?"],
  ["place name after 'in'", "Our studio is in London."],
  ["'ready-to-wear' is not a promise", "Ready-to-wear pieces are not part of this collection."],
  ["'finished with' is not a date", "This piece is finished with hand-sewn beading."],
]) {
  const r = applyGuardrails(text);
  check(`left untouched — ${label}`, r.clean && r.text === text);
}

console.log("\n=== GUARDRAILS: reporting and helpers ===");
const multi = applyGuardrails("It costs £500 and arrives within 2 weeks. Your order has shipped.");
check("all three rules reported together", new Set(multi.violations.map((v) => v.rule)).size === 3);
check("violations carry the matched text", multi.violations.every((v) => v.match.length > 0));
check("guardedOrNull suppresses dirty text", guardedOrNull("It costs £500.") === null);
check(
  "guardedOrNull passes clean text through",
  guardedOrNull("Made to order in silk.") === "Made to order in silk."
);
// Module-level /g regexes carry lastIndex between calls if not reset —
// a real bug class, so assert repeat calls are identical.
const first = applyGuardrails("It costs £100.");
const second = applyGuardrails("It costs £100.");
check("repeated calls are stable (no regex lastIndex leak)", first.text === second.text);

console.log("\n=== FAQ MATCHING: deterministic engine ===");
const FAQS = [
  { id: "f1", question: "How long does a bespoke order take?", answer: "Bespoke orders are made to order after your measurements are confirmed." },
  { id: "f2", question: "Do you ship internationally?", answer: "We ship worldwide from our UK studio." },
  { id: "f3", question: "Can I return a custom piece?", answer: "Custom pieces are made to your measurements and cannot be returned." },
];
check("matches on strong overlap", matchFaq("how long does a bespoke order take", FAQS)?.faqId === "f1");
check("matches on keyword overlap", matchFaq("do you ship internationally?", FAQS)?.faqId === "f2");
check("matches returns the admin's answer verbatim", matchFaq("bespoke order", FAQS)?.answer === FAQS[0].answer);
check("unrelated question returns NO match rather than a guess", matchFaq("what is the weather today", FAQS) === null);
check("single incidental word does not match", matchFaq("can you help", FAQS) === null);
check("empty question returns null", matchFaq("", FAQS) === null);
check("empty FAQ set returns null", matchFaq("how long does an order take", []) === null);
check("stopwords are stripped", !tokenize("what is the how of it").includes("what"));
check("short tokens are stripped", !tokenize("a an of to").length);
const conf = matchFaq("how long does a bespoke order take?", FAQS);
check("confidence is within 0-1", conf !== null && conf.confidence > 0 && conf.confidence <= 1);

console.log("\n=== PROVIDER SELECTION ===");
check("no key → deterministic (the free default)", selectProvider({}) === "deterministic");
check("key present → claude", selectProvider({ apiKey: "sk-test" }) === "claude");
check(
  "explicit override beats a present key",
  selectProvider({ apiKey: "sk-test", override: "deterministic" }) === "deterministic"
);
check("empty-string key is treated as unset", selectProvider({ apiKey: "" }) === "deterministic");
check(
  "this environment resolves to deterministic",
  selectProvider({ apiKey: process.env.ANTHROPIC_API_KEY, override: process.env.AI_PROVIDER }) ===
    "deterministic"
);

// ---------------------------------------------------------------------
// Sweep fixtures leaked by a PREVIOUS crashed run, before creating new
// ones.
//
// This is the same "idempotent setup, not better teardown" rule the
// devtest accounts already follow, and it is here because the failure
// actually happened: a run that died before its cleanup left an "AI Test
// Cat <timestamp>" category and five "AI <label>" products sitting on the
// live storefront, where the owner saw them as filter chips next to Asian
// Wear and Western Wear. Teardown cannot fix that — a crashed process
// does not run its teardown. Only the next startup can.
//
// The slugs are matched by shape (`ai-…-<13-digit epoch ms>`), so this can
// only ever match a fixture this script itself created.
console.log("\n=== Sweeping leaked fixtures from previous runs ===");
{
  const { data: staleProducts } = await admin
    .from("products")
    .select("id")
    .or("slug.like.ai-source-1%,slug.like.ai-near-1%,slug.like.ai-far-1%,slug.like.ai-coviewed-1%,slug.like.ai-draft-1%");
  if (staleProducts?.length) {
    await admin.from("products").delete().in("id", staleProducts.map((p) => p.id));
  }
  const { data: staleCats } = await admin
    .from("categories")
    .delete()
    .like("slug", "ai-test-cat-1%")
    .select("id");
  console.log(
    `swept ${staleProducts?.length ?? 0} products, ${staleCats?.length ?? 0} categories`
  );
}

// ---------------------------------------------------------------------
console.log("\n=== Setup: admin, customer, catalogue ===");
const staffAdmin = await signIn(`m22-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-e0");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);
const customer = await signIn(`m22-cust-${suffix}@luxury-couture-devtest.local`, "correct-horse-e1");

const { data: category } = await admin
  .from("categories")
  .insert({ name: `AI Test Cat ${suffix}`, slug: `ai-test-cat-${suffix}` })
  .select()
  .single();

async function makeProduct(label, price, status = "published") {
  const { data } = await admin
    .from("products")
    .insert({
      name: `AI ${label} ${suffix}`,
      slug: `ai-${label}-${suffix}`,
      base_price: price,
      currency: "GBP",
      status,
      category_id: category.id,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();
  return data;
}

const source = await makeProduct("source", 1000);
const nearPrice = await makeProduct("near", 1100);
const farPrice = await makeProduct("far", 9000);
const coViewed = await makeProduct("coviewed", 8000);
const draft = await makeProduct("draft", 1050, "draft");

console.log("\n=== RECOMMENDATIONS: catalog tiers work with zero traffic ===");
const pdp = await get(`/products/${source.slug}`);
check("product page renders", pdp.status === 200);
check("recommends the near-price product from the same category", pdp.html.includes(nearPrice.name));
check("a DRAFT product is never recommended", !pdp.html.includes(draft.name));
// Precise signal: the PDP must not link to its own URL. Counting name
// occurrences was wrong — the name legitimately appears in the title, OG
// tags, h1, breadcrumbs and JSON-LD.
check(
  "source product is not recommended to itself",
  !pdp.html.includes(`href="/products/${source.slug}"`)
);

console.log("\n=== RECOMMENDATIONS: affinity data never resurrects a draft ===");
//
// CORRECTED IN MODULE 31. This block used to assert "co-viewed product
// now appears", claiming to prove the behavioural tier outranks the
// catalog tiers. It was passing for the WRONG REASON, and the demo data
// exposed it.
//
// getCoViewAffinity() reads analytics_events through the RLS client, and
// an anonymous visitor cannot read that table — established directly
// below rather than assumed. So on the storefront the behavioural tier
// ALWAYS returns nothing and the chain degrades to the catalog tiers.
// recommendations.ts documents exactly this and calls it "the correct
// and safe behaviour"; the test was the thing overclaiming.
//
// It passed because the catalog fallback had almost nothing to choose
// from in a near-empty shop, so the co-viewed product came back as
// filler. With twelve demo products competing it no longer places.
//
// What is asserted now is what actually holds, and it is the half that
// carries real risk: affinity data must never resurrect a draft.
const anonProbe = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: anonAnalytics } = await anonProbe
  .from("analytics_events")
  .select("session_id")
  .eq("event_name", "product_view")
  .limit(1);
const anonCanReadAnalytics = (anonAnalytics?.length ?? 0) > 0;

const coViewRows = [];
for (let i = 0; i < 6; i += 1) {
  const session = `m22-sess-${suffix}-${i}`;
  coViewRows.push({ event_name: "product_view", session_id: session, properties: { productId: source.id } });
  coViewRows.push({ event_name: "product_view", session_id: session, properties: { productId: coViewed.id } });
}
await admin.from("analytics_events").insert(coViewRows);

const pdpAfter = await get(`/products/${source.slug}`);
check(
  "the storefront cannot read analytics, so the behavioural tier stays inert",
  !anonCanReadAnalytics,
  "documented in recommendations.ts — see the note above"
);
check("draft still never appears even with affinity data", !pdpAfter.html.includes(draft.name));

// Affinity for a draft product must not resurrect it.
await admin.from("analytics_events").insert([
  { event_name: "product_view", session_id: `m22-sess-${suffix}-0`, properties: { productId: draft.id } },
]);
const pdpDraftAffinity = await get(`/products/${source.slug}`);
check("a draft with co-view affinity is still filtered out", !pdpDraftAffinity.html.includes(draft.name));

console.log("\n=== ai_generations RLS ===");
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: seeded } = await admin
  .from("ai_generations")
  .insert({
    kind: "product_description",
    provider: "deterministic",
    prompt_summary: `test ${suffix}`,
    output: "Test output.",
    actor_id: staffAdmin.userId,
  })
  .select()
  .single();

const { data: anonRead } = await anon.from("ai_generations").select("id").limit(5);
check("anonymous cannot read ai_generations", (anonRead ?? []).length === 0);
const { data: custRead } = await customer.client.from("ai_generations").select("id").limit(5);
check("a customer cannot read ai_generations", (custRead ?? []).length === 0);
const { data: adminRead } = await staffAdmin.client.from("ai_generations").select("id").limit(5);
check("an admin can read ai_generations", (adminRead ?? []).length > 0);

const { error: anonInsert } = await anon
  .from("ai_generations")
  .insert({ kind: "x", provider: "x", output: "x" });
check("anonymous cannot insert ai_generations", Boolean(anonInsert));
const { error: custInsert } = await customer.client
  .from("ai_generations")
  .insert({ kind: "x", provider: "x", output: "x" });
check("a customer cannot insert ai_generations", Boolean(custInsert));

console.log("\n=== Admin surfaces ===");
const adminCookie = sessionCookieHeader(staffAdmin.session);
const customerCookie = sessionCookieHeader(customer.session);

const newProductPage = await get("/admin/products/new", adminCookie);
check("admin product form renders", newProductPage.status === 200);
check("product form offers AI drafting", newProductPage.html.includes("Write with AI"));
check(
  "product form discloses the guardrails to the admin",
  newProductPage.html.includes("never mention price")
);
check(
  "a customer cannot reach the product form",
  (await get("/admin/products/new", customerCookie)).status !== 200
);

console.log("\n=== AI cannot alter business records ===");
// The strongest structural claim this module makes: generation has no
// write path to a product or an order. Assert the source rows are
// untouched after everything above has run.
const { data: productAfter } = await admin
  .from("products")
  .select("base_price, status, name")
  .eq("id", source.id)
  .single();
check("product base_price unchanged", Number(productAfter.base_price) === 1000);
check("product status unchanged", productAfter.status === "published");
check("product name unchanged", productAfter.name === source.name);

console.log("\nCleaning up...");
await admin.from("ai_generations").delete().eq("id", seeded.id);
await admin.from("analytics_events").delete().like("session_id", `m22-sess-${suffix}%`);
await admin
  .from("products")
  .delete()
  .in("id", [source.id, nearPrice.id, farPrice.id, coViewed.id, draft.id]);
await admin.from("categories").delete().eq("id", category.id);
await admin.auth.admin.deleteUser(staffAdmin.userId);
await admin.auth.admin.deleteUser(customer.userId);

const [{ data: rProducts }, { data: rGenerations }, { data: rEvents }] = await Promise.all([
  admin.from("products").select("id"),
  admin.from("ai_generations").select("id"),
  admin.from("analytics_events").select("id"),
]);
console.log(
  `Remaining — products: ${rProducts.length}, ai_generations: ${rGenerations.length}, analytics_events: ${rEvents.length} (should reflect pre-existing state only)`
);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

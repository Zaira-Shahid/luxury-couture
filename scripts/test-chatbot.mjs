// Module 23 — Customer Chatbot & Recommendation System verification.
//
// Requires a running server (npm run build && npm run start) and
// .env.local loaded:
//   node --env-file=.env.local scripts/test-chatbot.mjs
//
// Pure logic (intent parsing) is imported straight from the .ts source
// under Node's type stripping — query-intent.ts is deliberately
// import-free for exactly this reason, like guardrails.ts before it.
// Everything else is exercised over HTTP and against the database.
import { createClient } from "@supabase/supabase-js";

import { applyGuardrails } from "../src/lib/ai/guardrails.ts";
import { looksLikeDiscovery, parseQueryIntent } from "../src/lib/ai/query-intent.ts";

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
async function chat(message, sessionId) {
  const res = await fetch(`${appUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, ...json };
}

// ---------------------------------------------------------------------
console.log("=== INTENT PARSING: catalogue vocabulary only ===");
const VOCAB = {
  occasions: [
    { slug: "bridal", name: "Bridal" },
    { slug: "mehndi", name: "Mehndi" },
    { slug: "walima", name: "Walima" },
  ],
  colours: [
    { slug: "emerald-green", name: "Emerald Green" },
    { slug: "maroon", name: "Maroon" },
  ],
  fabrics: [
    { slug: "silk", name: "Silk" },
    { slug: "net", name: "Net" },
  ],
  categories: [{ slug: "bridal-lehengas", name: "Bridal Lehengas" }],
};

check("recognises an occasion", parseQueryIntent("something for a mehndi", VOCAB).occasionSlug === "mehndi");
check(
  "recognises an occasion synonym",
  parseQueryIntent("what should I wear to a sangeet", VOCAB).occasionSlug === "mehndi"
);
check(
  "recognises a wedding synonym as bridal",
  parseQueryIntent("looking for my wedding day", VOCAB).occasionSlug === "bridal"
);
check(
  "recognises a multi-word colour",
  parseQueryIntent("show me emerald green pieces", VOCAB).colourNames.includes("Emerald Green")
);
check("recognises a fabric", parseQueryIntent("do you have silk", VOCAB).fabricNames.includes("Silk"));
check(
  "recognises a category",
  parseQueryIntent("browse bridal lehengas", VOCAB).categorySlug === "bridal-lehengas"
);
check(
  "combines occasion and colour",
  (() => {
    const i = parseQueryIntent("something maroon for a walima", VOCAB);
    return i.occasionSlug === "walima" && i.colourNames.includes("Maroon");
  })()
);

// The safety property: it cannot invent a term the shop does not sell.
const invented = parseQueryIntent("do you have anything in chartreuse taffeta", VOCAB);
check("does NOT invent a colour outside the catalogue", invented.colourNames.length === 0);
check("does NOT invent a fabric outside the catalogue", invented.fabricNames.length === 0);
check("empty query yields an empty intent", parseQueryIntent("", VOCAB).isEmpty === true);
check(
  "pure stopwords yield an empty intent",
  parseQueryIntent("hello can you help me please", VOCAB).isEmpty === true
);

console.log("\n=== INTENT ROUTING: discovery vs FAQ ===");
const shipQ = "do you ship internationally";
check(
  "an FAQ question is NOT routed to discovery",
  looksLikeDiscovery(shipQ, parseQueryIntent(shipQ, VOCAB)) === false
);
const measureQ = "how do I give my measurements";
check(
  "a measurements question is NOT routed to discovery",
  looksLikeDiscovery(measureQ, parseQueryIntent(measureQ, VOCAB)) === false
);
const discQ = "something for a mehndi";
check(
  "a catalogue term routes to discovery",
  looksLikeDiscovery(discQ, parseQueryIntent(discQ, VOCAB)) === true
);
const showQ = "show me some ideas";
check(
  "an explicit browse request routes to discovery",
  looksLikeDiscovery(showQ, parseQueryIntent(showQ, VOCAB)) === true
);

console.log("\n=== SEEDED KNOWLEDGE ===");
const { data: seededFaqs } = await admin.from("faqs").select("id, question, answer");
check("starter FAQs are present", (seededFaqs ?? []).length >= 12);
let dirtyFaqs = 0;
for (const faq of seededFaqs ?? []) {
  if (!applyGuardrails(faq.answer).clean) dirtyFaqs += 1;
}
// A FAQ answer containing a price or a date would be SUPPRESSED entirely
// on a customer surface, so seeded content that trips guardrails would be
// invisible — that must not happen.
check("every seeded FAQ answer passes guardrails (none would be suppressed)", dirtyFaqs === 0);

const { data: seededOccasions } = await admin.from("occasions").select("id, slug");
check("occasions are seeded", (seededOccasions ?? []).length >= 6);
const { count: linkCount } = await admin
  .from("builder_option_occasions")
  .select("occasion_id", { count: "exact", head: true });
check("builder options are linked to occasions", (linkCount ?? 0) > 0);

console.log("\n=== CHAT ENDPOINT: validation ===");
const session = `m23-sess-${suffix}`;
const badBody = await fetch(`${appUrl}/api/chat`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "not json",
});
check("malformed JSON is rejected (400)", badBody.status === 400);
check("empty message is rejected (400)", (await chat("", session)).status === 400);
check("missing session is rejected (400)", (await chat("hello", "x")).status === 400);
check("an over-long message is rejected (413)", (await chat("x".repeat(600), session)).status === 413);

console.log("\n=== CHAT ENDPOINT: answers come from FAQs only ===");
const shipping = await chat("do you ship internationally", `${session}-a`);
check("answers a covered question (200)", shipping.status === 200);
check("the answer is not flagged unanswered", shipping.unanswered === false);
check(
  "the answer matches the seeded FAQ text",
  typeof shipping.reply === "string" && shipping.reply.toLowerCase().includes("worldwide")
);

const nonsense = await chat("what is the airspeed velocity of a swallow", `${session}-b`);
check("an unanswerable question is flagged unanswered", nonsense.unanswered === true);
check(
  "it says it does not know rather than inventing an answer",
  typeof nonsense.reply === "string" && /don't have a confident answer|couldn't find/i.test(nonsense.reply)
);
check("no products are fabricated for an unanswerable question", (nonsense.products ?? []).length === 0);

console.log("\n=== CHAT ENDPOINT: discovery returns real rows only ===");
const { data: category } = await admin
  .from("categories")
  .insert({ name: `Chat Cat ${suffix}`, slug: `chat-cat-${suffix}` })
  .select()
  .single();

async function makeProduct(label, status) {
  const { data } = await admin
    .from("products")
    .insert({
      name: `Chat ${label} Emerald ${suffix}`,
      slug: `chat-${label}-${suffix}`,
      description: "An emerald green silk piece.",
      base_price: 1500,
      currency: "GBP",
      status,
      category_id: category.id,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();
  return data;
}
const livePiece = await makeProduct("live", "published");
const draftPiece = await makeProduct("draft", "draft");

const mehndiOccasion = (seededOccasions ?? []).find((o) => o.slug === "mehndi");
await admin
  .from("product_occasions")
  .insert([
    { product_id: livePiece.id, occasion_id: mehndiOccasion.id },
    { product_id: draftPiece.id, occasion_id: mehndiOccasion.id },
  ]);

const discovery = await chat("something for a mehndi", `${session}-c`);
check("discovery returns 200", discovery.status === 200);
check(
  "the published product is suggested",
  (discovery.products ?? []).some((p) => p.id === livePiece.id)
);
check(
  "a DRAFT product is never suggested, even when tagged",
  !(discovery.products ?? []).some((p) => p.id === draftPiece.id)
);
check(
  "suggestions carry real database fields",
  (discovery.products ?? []).every((p) => p.slug && typeof p.price === "number")
);

// The unmatched term is generated rather than hardcoded: this used to
// ask for "chartreuse", which stopped being an impossible request the
// moment the demo catalogue gained a chartreuse piece. A run-unique
// nonsense word can never be a real product.
const noMatch = await chat(`show me something in zzq${suffix}nope`, `${session}-d`);
check("an unmatched discovery query invents nothing", (noMatch.products ?? []).length === 0);
check("and is flagged unanswered so it reaches a human", noMatch.unanswered === true);

console.log("\n=== SEARCH: the SearchAction declared in Module 20 is now real ===");
const searchPage = await get(`/products?q=Emerald+${suffix}`);
check("/products?q= returns 200", searchPage.status === 200);
check("search finds the published product", searchPage.html.includes(livePiece.name));
check("search excludes the draft product", !searchPage.html.includes(draftPiece.name));
const occasionPage = await get("/products?occasion=mehndi");
check("/products?occasion= filters", occasionPage.status === 200);
check("occasion filter shows the tagged product", occasionPage.html.includes(livePiece.name));
const emptySearch = await get(`/products?q=zzzznothingmatches${suffix}`);
check(
  "a search with no matches explains itself rather than showing everything",
  emptySearch.html.includes("Nothing matched that")
);

console.log("\n=== RATE LIMITING (before any provider call) ===");
const floodSession = `m23-flood-${suffix}`;
let limitedAt = -1;
for (let i = 0; i < 16; i += 1) {
  const res = await chat(`question number ${i}`, floodSession);
  if (res.status === 429) {
    limitedAt = i;
    break;
  }
}
check("a burst is eventually rate limited", limitedAt > 0);
check("the limit allows a reasonable number of real messages first", limitedAt >= 8);
const limitedResponse = await chat("one more", floodSession);
check("further messages stay limited (429)", limitedResponse.status === 429);
check("the refusal is friendly, not an error code", typeof limitedResponse.reply === "string" && limitedResponse.reply.length > 20);
check("the refusal sets retry-after semantics", limitedResponse.rateLimited === true);
// A refused request must not have produced a transcript entry, which
// proves the limiter ran before the work.
const { data: floodConv } = await admin
  .from("chat_conversations")
  .select("id")
  .eq("session_id", floodSession)
  .maybeSingle();
const { count: floodMsgs } = floodConv
  ? await admin
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", floodConv.id)
  : { count: 0 };
check("accepted messages were processed and logged", (floodMsgs ?? 0) > 0);
check(
  "refused messages were NOT processed (transcript stops at the limit)",
  (floodMsgs ?? 0) <= limitedAt * 2
);

console.log("\n=== FAQ BACKLOG ===");
const { data: backlog } = await admin
  .from("chat_messages")
  .select("content, role, unanswered")
  .eq("unanswered", true)
  .eq("role", "user");
check("unanswered questions are recorded against the USER message", (backlog ?? []).length > 0);
check(
  "the recorded text is the customer's question",
  (backlog ?? []).some((m) => m.content.includes("airspeed velocity"))
);

console.log("\n=== RLS on chat tables ===");
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: anonConvs } = await anon.from("chat_conversations").select("id").limit(5);
check("anonymous cannot read conversations", (anonConvs ?? []).length === 0);
const { data: anonMsgs } = await anon.from("chat_messages").select("id").limit(5);
check("anonymous cannot read messages", (anonMsgs ?? []).length === 0);
const { error: anonForge } = await anon
  .from("chat_messages")
  .insert({ conversation_id: floodConv?.id ?? livePiece.id, role: "assistant", content: "forged" });
check("anonymous cannot forge a transcript", Boolean(anonForge));
const { data: anonLimits } = await anon.from("chat_rate_limits").select("key_hash").limit(5);
check("anonymous cannot read rate-limit counters", (anonLimits ?? []).length === 0);

const customer = await signIn(`m23-cust-${suffix}@luxury-couture-devtest.local`, "correct-horse-f1");
const { data: custMsgs } = await customer.client.from("chat_messages").select("id").limit(5);
check("a customer cannot read messages", (custMsgs ?? []).length === 0);

const staffAdmin = await signIn(`m23-admin-${suffix}@luxury-couture-devtest.local`, "correct-horse-f0");
await admin.from("profiles").update({ role: "admin" }).eq("id", staffAdmin.userId);
const { data: adminMsgs } = await staffAdmin.client.from("chat_messages").select("id").limit(5);
check("an admin can read messages", (adminMsgs ?? []).length > 0);

console.log("\n=== Storefront and admin surfaces ===");
const home = await get("/");
// The widget renders collapsed, so its panel copy only exists after the
// customer opens it client-side. Assert on what is genuinely in the
// server HTML: the launcher button, and that the old mock widget is gone.
check("the assistant widget is mounted on the storefront", home.html.includes('aria-label="Open chat"'));
check("the mock enquiry widget is no longer the default", !home.html.includes("Chat with us"));

const adminCookie = sessionCookieHeader(staffAdmin.session);
const adminContent = await get("/admin/content", adminCookie);
check("admin content page renders", adminContent.status === 200);
check("occasions section is present", adminContent.html.includes("Occasions"));
check("FAQ backlog section is present", adminContent.html.includes("couldn&#x27;t answer") || adminContent.html.includes("couldn’t answer"));
check("the unanswered question is listed for the admin", adminContent.html.includes("airspeed velocity"));
check(
  "a customer cannot reach admin content",
  (await get("/admin/content", sessionCookieHeader(customer.session))).status !== 200
);
const newOccasion = await get("/admin/content/occasions/new", adminCookie);
check("occasion form renders for admin", newOccasion.status === 200);

console.log("\n=== Builder guidance uses curated data ===");
const builder = await get("/builder");
check("builder renders", builder.status === 200);
// The fabric/colour steps are reached by client-side navigation, so the
// tiles aren't in the initial HTML. Assert the DATA the guidance is built
// from instead — that it exists and points at real option rows rather
// than generated text.
const { data: fabricLinks } = await admin
  .from("builder_option_occasions")
  .select("option_id")
  .eq("option_table", "fabrics");
check("fabrics are linked to occasions", (fabricLinks ?? []).length > 0);
const uniqueFabricIds = [...new Set((fabricLinks ?? []).map((l) => l.option_id))];
const { data: realFabrics } = await admin.from("fabrics").select("id").in("id", uniqueFabricIds);
check(
  "every guidance link points at a real fabric row",
  (realFabrics ?? []).length === uniqueFabricIds.length
);
const { data: colourLinks } = await admin
  .from("builder_option_occasions")
  .select("option_id")
  .eq("option_table", "colours");
check("colours are linked to occasions", (colourLinks ?? []).length > 0);

console.log("\nCleaning up...");
await admin.from("product_occasions").delete().in("product_id", [livePiece.id, draftPiece.id]);
await admin.from("products").delete().in("id", [livePiece.id, draftPiece.id]);
await admin.from("categories").delete().eq("id", category.id);
const { data: convs } = await admin
  .from("chat_conversations")
  .select("id")
  .like("session_id", `m23-%${suffix}%`);
const convIds = (convs ?? []).map((c) => c.id);
if (convIds.length) {
  await admin.from("chat_messages").delete().in("conversation_id", convIds);
  await admin.from("chat_conversations").delete().in("id", convIds);
}
// Session-keyed conversations created with the plain `${session}-x` form.
const { data: convs2 } = await admin
  .from("chat_conversations")
  .select("id")
  .like("session_id", `m23-sess-${suffix}%`);
const convIds2 = (convs2 ?? []).map((c) => c.id);
if (convIds2.length) {
  await admin.from("chat_messages").delete().in("conversation_id", convIds2);
  await admin.from("chat_conversations").delete().in("id", convIds2);
}
await admin.from("chat_rate_limits").delete().neq("key_hash", "");
await admin.auth.admin.deleteUser(staffAdmin.userId);
await admin.auth.admin.deleteUser(customer.userId);

const [{ data: rProducts }, { data: rConvs }, { data: rMsgs }] = await Promise.all([
  admin.from("products").select("id"),
  admin.from("chat_conversations").select("id"),
  admin.from("chat_messages").select("id"),
]);
console.log(
  `Remaining — products: ${rProducts.length}, conversations: ${rConvs.length}, messages: ${rMsgs.length} (should reflect pre-existing state only)`
);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

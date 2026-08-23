// Module 28 Pass 1 — accessibility assertions against real rendered HTML.
//
// Lighthouse cannot run here (no Chromium), so rather than claim a score
// this checks the properties that can actually be verified from the
// server's own output: landmarks, labels, alt text, heading order, and
// the skip link. Every one of these is a thing a screen-reader or
// keyboard user depends on, and every one is decidable from the markup.
//
// What this deliberately does NOT do is simulate a browser. Focus order,
// contrast-on-render and ARIA live behaviour are not observable here —
// contrast is covered separately and exactly, by test-contrast.mjs.
//
//   node --env-file=.env.local scripts/test-a11y.mjs
//
// Needs a running production server.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
const failures = [];
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
  if (ok) passed += 1;
  else {
    failed += 1;
    failures.push(`${label}${detail ? ` (${detail})` : ""}`);
  }
}

// ---------------------------------------------------------------------
// Crude but sufficient HTML probes. A real parser would be better; these
// are chosen so a false PASS is unlikely, which is the property that
// matters for a guard.

const stripComments = (html) => html.replaceAll("<!-- -->", "");

/**
 * Removes <script> blocks before any structural analysis.
 *
 * This matters more than it looks: Next embeds the RSC flight payload in
 * inline <script> tags, and that payload contains escaped copies of the
 * whole component tree — every "h1", "img" and "tabindex" in it as
 * string data. Counting tags without stripping scripts would measure the
 * serialised payload as well as the document, so a page with one <h1>
 * reads as having several and the check fails on nothing at all.
 */
const stripScripts = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, "");

function tags(html, tagName) {
  const re = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  return html.match(re) ?? [];
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return m ? m[1] : null;
}

function hasAttr(tag, name) {
  return new RegExp(`\\b${name}[=\\s>]`, "i").test(tag);
}

// ---------------------------------------------------------------------
// A signed-in session, so the account and admin areas can be checked too
// — they are where the hand-rolled widgets live.

const suffix = Date.now();
const email = `m28-a11y-${suffix}@luxury-couture-devtest.local`;
const password = `m28-a11y-${suffix}`;
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createErr) throw new Error(`createUser: ${createErr.message}`);

const client = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: session } = await client.auth.signInWithPassword({ email, password });

function sessionCookie(s) {
  const ref = new URL(url).hostname.split(".")[0];
  return `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(s), "utf8").toString("base64url")}`;
}
const cookie = sessionCookie(session.session);

async function get(path, authed = false) {
  const res = await fetch(APP_URL + path, {
    headers: authed ? { cookie } : {},
    redirect: "manual",
  });
  return { status: res.status, html: stripComments(await res.text()) };
}

// A representative slice rather than every route: one per layout, plus
// the pages carrying forms and images.
const ROUTES = [
  ["/", false, "home"],
  ["/products", false, "product listing"],
  ["/collections", false, "collections"],
  ["/contact", false, "contact form"],
  ["/faq", false, "FAQ"],
  ["/login", false, "sign in"],
  ["/register", false, "register"],
  ["/forgot-password", false, "forgot password"],
  ["/cart", false, "cart"],
  ["/account", true, "account home"],
  ["/account/notifications", true, "notification centre"],
  ["/account/notifications/preferences", true, "notification preferences"],
];

const pages = [];
for (const [path, authed, label] of ROUTES) {
  const page = await get(path, authed);
  pages.push({ path, label, ...page, markup: stripScripts(page.html) });
}

// ---------------------------------------------------------------------
console.log("\n# Every route renders");
for (const page of pages) {
  check(`${page.label} renders`, page.status === 200, `${page.path} -> ${page.status}`);
}

const rendered = pages.filter((p) => p.status === 200);

// ---------------------------------------------------------------------
console.log("\n# Document-level requirements");

for (const page of rendered) {
  check(`${page.label}: <html lang> is set`, /<html[^>]+lang="[a-z-]+"/i.test(page.markup));
}

for (const page of rendered) {
  const title = page.markup.match(/<title>([^<]*)<\/title>/i);
  check(
    `${page.label}: has a non-empty <title>`,
    !!title && title[1].trim().length > 0,
    title?.[1]?.slice(0, 40)
  );
}

// ---------------------------------------------------------------------
console.log("\n# Landmarks and the skip link");

for (const page of rendered) {
  check(
    `${page.label}: skip link is present`,
    page.markup.includes('href="#main-content"'),
    undefined
  );
}

for (const page of rendered) {
  // The skip link is worthless if its target does not exist — which was
  // the case for the account and auth areas before this module, because
  // neither layout had a <main> at all.
  check(`${page.label}: skip link has a real target`, page.markup.includes('id="main-content"'));
}

for (const page of rendered) {
  const mains = tags(page.markup, "main");
  check(
    `${page.label}: exactly one <main> landmark`,
    mains.length === 1,
    `${mains.length} found`
  );
}

// ---------------------------------------------------------------------
console.log("\n# Images");

for (const page of rendered) {
  const imgs = tags(page.markup, "img");
  const missing = imgs.filter((tag) => !hasAttr(tag, "alt"));
  check(
    `${page.label}: every <img> has an alt attribute`,
    missing.length === 0,
    `${imgs.length} images, ${missing.length} missing`
  );
}

// ---------------------------------------------------------------------
console.log("\n# Form controls have accessible names");

for (const page of rendered) {
  const inputs = tags(page.markup, "input").filter((tag) => {
    const type = (attr(tag, "type") ?? "text").toLowerCase();
    // Hidden inputs and CSRF-ish fields carry no user-facing semantics.
    return type !== "hidden";
  });

  const unnamed = inputs.filter((tag) => {
    if (hasAttr(tag, "aria-label") || hasAttr(tag, "aria-labelledby")) return false;
    const id = attr(tag, "id");
    // A <label for="..."> elsewhere in the document counts.
    if (id && page.markup.includes(`for="${id}"`)) return false;
    // So does a wrapping <label>, which this cannot see directly — the
    // proxy is that the input sits inside a <label> tag pair somewhere.
    // Checked by looking for the input's own markup inside a label block.
    const labelBlocks = page.markup.match(/<label\b[\s\S]*?<\/label>/gi) ?? [];
    return !labelBlocks.some((block) => block.includes(tag));
  });

  check(
    `${page.label}: every visible input has a label`,
    unnamed.length === 0,
    `${inputs.length} inputs, ${unnamed.length} unnamed`
  );
}

// ---------------------------------------------------------------------
console.log("\n# Buttons have accessible names");

for (const page of rendered) {
  const buttonBlocks = page.markup.match(/<button\b[\s\S]*?<\/button>/gi) ?? [];
  const unnamed = buttonBlocks.filter((block) => {
    const openTag = block.match(/<button\b[^>]*>/i)?.[0] ?? "";
    if (hasAttr(openTag, "aria-label") || hasAttr(openTag, "aria-labelledby")) return false;
    // Text content, with any nested markup (an icon <svg>) removed.
    const text = block.replace(/<[^>]+>/g, "").trim();
    return text.length === 0;
  });
  check(
    `${page.label}: every <button> has a name`,
    unnamed.length === 0,
    `${buttonBlocks.length} buttons, ${unnamed.length} unnamed`
  );
}

// ---------------------------------------------------------------------
console.log("\n# Heading structure");

for (const page of rendered) {
  const h1s = tags(page.markup, "h1");
  check(`${page.label}: exactly one <h1>`, h1s.length === 1, `${h1s.length} found`);
}

for (const page of rendered) {
  // Levels must not skip on the way down (h2 -> h4). Going back up is
  // fine: that is a new section, not a broken outline.
  const levels = [...page.markup.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  let previous = 0;
  const skips = [];
  for (const level of levels) {
    if (previous && level > previous + 1) skips.push(`h${previous} -> h${level}`);
    previous = level;
  }
  check(
    `${page.label}: no skipped heading levels`,
    skips.length === 0,
    skips.join(", ") || `${levels.length} headings`
  );
}

// ---------------------------------------------------------------------
console.log("\n# No positive tabindex anywhere");

for (const page of rendered) {
  // A positive tabindex overrides document order and is almost always a
  // bug; -1 and 0 are both legitimate.
  const positive = page.markup.match(/tabindex="[1-9]/gi) ?? [];
  check(`${page.label}: no positive tabindex`, positive.length === 0, `${positive.length} found`);
}

// ---------------------------------------------------------------------
console.log("\n# Reduced motion is honoured");

// The global override lives in globals.css, which is compiled into the
// stylesheet the page links. Fetch it and confirm the rule survived the
// build rather than trusting that it was written.
// ALL linked stylesheets, not just the first. An earlier version of this
// checked only the first match and reported both rules missing — they
// were present, in the second file. A guard that fails on its own
// sampling error is worse than no guard, because it teaches you to
// ignore it.
const cssHrefs = [
  ...new Set(
    [...pages[0].html.matchAll(/href="(\/_next\/static\/css\/[^"]+\.css)"/g)].map((m) => m[1])
  ),
];
check("stylesheets are linked", cssHrefs.length > 0, `${cssHrefs.length} found`);

let allCss = "";
for (const href of cssHrefs) allCss += await (await fetch(APP_URL + href)).text();

check(
  "the compiled CSS contains a prefers-reduced-motion block",
  allCss.includes("prefers-reduced-motion")
);
check("the skip-link class survived the build", allCss.includes(".skip-link"));

// ---------------------------------------------------------------------
await admin.auth.admin.deleteUser(created.user.id);

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed === 0 ? 0 : 1);

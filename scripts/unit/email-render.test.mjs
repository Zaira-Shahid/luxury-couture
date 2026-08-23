// Unit tests for lib/email/render.ts.
//
// Two properties carry real consequence here:
//
//  1. ESCAPING. Email bodies interpolate customer-supplied text (names,
//     order notes, review copy). An unescaped angle bracket in a mail
//     client is a broken email at best.
//  2. THE UNSUBSCRIBE RULE. buildMarketingEmail takes the unsubscribe URL
//     as a REQUIRED argument, so a marketing email without a working
//     opt-out cannot be constructed. That is a compile-time guarantee in
//     TypeScript; these tests assert it holds at runtime too, and that
//     transactional mail correctly does NOT carry one.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMarketingEmail,
  buildTransactionalEmail,
  escapeHtml,
} from "../../src/lib/email/render.ts";

const brand = {
  name: "Luxury Lehenga Couture",
  logoUrl: null,
  accent: "#b8860b",
  siteUrl: "https://example.test",
};

const body = { heading: "Your order", paragraphs: ["Thank you for your order."] };

test("escapeHtml neutralises every dangerous character", () => {
  assert.equal(escapeHtml("<script>"), "&lt;script&gt;");
  assert.equal(escapeHtml('a "quoted" value'), "a &quot;quoted&quot; value");
  assert.equal(escapeHtml("it's"), "it&#39;s");
  // Ampersand must be escaped FIRST or the other replacements double-escape.
  assert.equal(escapeHtml("&lt;"), "&amp;lt;");
});

test("a heading containing markup is escaped in the HTML", () => {
  const rendered = buildTransactionalEmail(brand, {
    heading: '<img src=x onerror="alert(1)">',
    paragraphs: ["Hello."],
  });
  assert.equal(rendered.html.includes("<img src=x"), false, "raw tag must not survive");
  assert.ok(rendered.html.includes("&lt;img"));
});

test("a paragraph containing markup is escaped", () => {
  const rendered = buildTransactionalEmail(brand, {
    heading: "Hi",
    paragraphs: ["</p><script>alert(1)</script>"],
  });
  assert.equal(rendered.html.includes("<script>"), false);
});

test("a transactional email carries NO unsubscribe link", () => {
  const rendered = buildTransactionalEmail(brand, body);
  assert.equal(/unsubscribe/i.test(rendered.html), false);
  assert.equal(/unsubscribe/i.test(rendered.text), false);
});

test("a marketing email always carries the unsubscribe link", () => {
  const url = "https://example.test/unsubscribe?token=abc";
  const rendered = buildMarketingEmail(brand, body, url);
  assert.ok(rendered.html.includes(url), "html must link it");
  assert.ok(rendered.text.includes(url), "plain text must include it too");
  assert.match(rendered.html, /unsubscribe/i);
});

test("an unsubscribe URL is escaped like any other interpolated value", () => {
  const rendered = buildMarketingEmail(brand, body, 'https://x.test/u?a=1&b="2"');
  assert.equal(rendered.html.includes('&b="2"'), false, "raw quotes would break the attribute");
  assert.ok(rendered.html.includes("&amp;b="));
});

test("both builders produce an HTML and a plain-text part", () => {
  for (const rendered of [
    buildTransactionalEmail(brand, body),
    buildMarketingEmail(brand, body, "https://example.test/u"),
  ]) {
    assert.ok(rendered.html.length > 0);
    assert.ok(rendered.text.length > 0);
    // A text part that is just stripped HTML is a common bug; the
    // heading should appear as readable text, not as markup.
    assert.ok(rendered.text.includes("Your order"));
    assert.equal(rendered.text.includes("<h1"), false);
  }
});

test("a call to action renders in both parts", () => {
  const rendered = buildTransactionalEmail(brand, {
    ...body,
    cta: { label: "View your order", url: "https://example.test/account/orders/1" },
  });
  assert.ok(rendered.html.includes("View your order"));
  assert.ok(rendered.text.includes("https://example.test/account/orders/1"));
});

test("an empty paragraph list does not throw", () => {
  const rendered = buildTransactionalEmail(brand, { heading: "Hi", paragraphs: [] });
  assert.ok(rendered.html.includes("Hi"));
});

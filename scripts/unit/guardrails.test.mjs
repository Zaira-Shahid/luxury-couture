// Unit tests for lib/ai/guardrails.ts — the AI output filter.
//
// This module is worth unit testing above all the others: it is the one
// place where a silent failure is directly customer-facing and legally
// awkward. A guardrail that stops catching delivery promises does not
// crash, does not log, and does not fail any integration test — it just
// starts letting the AI promise a bride her lehenga will arrive by
// Friday. The only way to notice is to assert the rules directly.
//
// Module 22 found TWO REAL HOLES here by writing tests: the date rule
// required a determiner ("by Friday" slipped through) and required a
// preposition ("dispatched tomorrow" slipped through). Both are pinned
// below so they cannot come back.
import { test } from "node:test";
import assert from "node:assert/strict";

import { applyGuardrails, guardedOrNull } from "../../src/lib/ai/guardrails.ts";

/** True when the input was altered — i.e. a rule fired. */
function redacted(input) {
  return !applyGuardrails(input).clean;
}

test("clean copy passes through untouched", () => {
  const input = "Our lehengas are hand-embroidered by artisans in Pakistan.";
  const result = applyGuardrails(input);
  assert.equal(result.clean, true);
  assert.equal(result.text, input);
  assert.deepEqual(result.violations, []);
});

test("ordinary prose containing a fulfilment verb is NOT redacted", () => {
  // The verb alone must not trigger: "hand-made in Pakistan" and
  // "finished by hand" are describing craft, not promising a date.
  assert.equal(redacted("Each piece is finished by hand in our atelier."), false);
  assert.equal(redacted("The embroidery is complete artistry."), false);
});

test("monetary amounts are redacted in every notation", () => {
  for (const input of [
    "That will be £1,200.",
    "The total is £1200.50.",
    "It costs GBP 1200.",
    "Around 500 pounds.",
    "That is $900 USD.",
    "About 750 EUR.",
  ]) {
    assert.equal(redacted(input), true, `expected redaction: ${input}`);
  }
});

test("a redacted amount is replaced, not merely flagged", () => {
  const result = applyGuardrails("The price is £1,200 for that design.");
  assert.equal(result.text.includes("1,200"), false, "the number must not survive");
  assert.match(result.text, /price removed/);
});

test("delivery promises are redacted WITHOUT a determiner (Module 22 regression)", () => {
  // "by Friday" — no "this"/"next"/"the". This exact shape slipped
  // through the original rule.
  assert.equal(redacted("It will be ready by Friday."), true);
  assert.equal(redacted("Your piece ships in weeks."), true);
});

test("delivery promises are redacted WITHOUT a preposition (Module 22 regression)", () => {
  // "dispatched tomorrow" — no "by"/"on"/"within". Also slipped through.
  assert.equal(redacted("It will be dispatched tomorrow."), true);
  assert.equal(redacted("We can have it delivered today."), true);
});

test("delivery promises are redacted across the usual phrasings", () => {
  for (const input of [
    "It arrives within 3 weeks.",
    "Delivered in 10 days.",
    "It ships on 14 March.",
    "Ready by this Friday.",
    "Complete in about 2-3 weeks.",
    "Finished before the weekend.",
  ]) {
    assert.equal(redacted(input), true, `expected redaction: ${input}`);
  }
});

test("guarantees about delivery are redacted even without a date", () => {
  assert.equal(redacted("We guarantee it will be delivered."), true);
  assert.equal(redacted("I promise your order will ship."), true);
});

test("order status claims are redacted", () => {
  for (const input of [
    "Your order has shipped.",
    "Your payment was received.",
    "Your parcel has been delivered.",
    "Your lehenga is confirmed.",
  ]) {
    assert.equal(redacted(input), true, `expected redaction: ${input}`);
  }
});

test("payment state claims are redacted", () => {
  assert.equal(redacted("Your deposit has been received."), true);
  assert.equal(redacted("The refund was successfully processed."), true);
});

test("money inside a delivery sentence is redacted as MONEY", () => {
  // Rule order is load-bearing and documented as such: money runs first
  // so an amount inside a delivery sentence is not swallowed whole by
  // the date rule, which would hide the price behind a timescale marker.
  const result = applyGuardrails("It will arrive in 3 weeks and costs £900.");
  assert.equal(result.text.includes("900"), false);
  const names = result.violations.map((v) => v.rule ?? v.name);
  assert.ok(
    names.some((n) => String(n).includes("monetary")),
    `expected a monetary violation, got ${JSON.stringify(names)}`
  );
});

test("multiple violations in one string are all reported", () => {
  const result = applyGuardrails("Your order has shipped and the balance is £400.");
  assert.equal(result.clean, false);
  assert.ok(result.violations.length >= 2, `expected 2+, got ${result.violations.length}`);
});

test("guardedOrNull returns the text when clean and null when not", () => {
  assert.equal(guardedOrNull("We offer bridal and occasion wear."), "We offer bridal and occasion wear.");
  // The customer-facing contract: a dirty result is discarded entirely
  // rather than shown with redaction markers in it.
  assert.equal(guardedOrNull("Your order has shipped."), null);
});

test("empty and whitespace input do not throw", () => {
  assert.equal(applyGuardrails("").clean, true);
  assert.equal(applyGuardrails("   ").clean, true);
});

// Unit tests for lib/notifications/categories.ts.
//
// The property that matters most here is the FAIL-OPEN one: an
// unclassified notification must never be suppressed by a preference.
// Getting that backwards would silently stop delivering a category of
// mail, with no error anywhere.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  NOTIFICATION_CATEGORIES,
  TYPE_CATEGORIES,
  categoryForType,
  isNotificationCategory,
  linkForNotification,
} from "../../src/lib/notifications/categories.ts";

test("every category has a label and a description", () => {
  for (const category of NOTIFICATION_CATEGORIES) {
    assert.ok(CATEGORY_LABELS[category], category);
    assert.ok(CATEGORY_DESCRIPTIONS[category], category);
  }
});

test("every mapped type points at a real category", () => {
  for (const [type, category] of Object.entries(TYPE_CATEGORIES)) {
    assert.ok(NOTIFICATION_CATEGORIES.includes(category), `${type} -> ${category}`);
  }
});

test("marketing is NOT a category", () => {
  // It lives on profiles.marketing_opt_out, which the one-click
  // unsubscribe link already writes. A second switch would be a second
  // source of truth for the same question.
  assert.equal(NOTIFICATION_CATEGORIES.includes("marketing"), false);
  assert.equal(isNotificationCategory("marketing"), false);
});

test("an unknown type resolves to null, never to a default category", () => {
  // Null means "never suppressed by a preference". A default would mean
  // a new notification type could be silently muted by an unrelated
  // opt-out the customer set months earlier.
  assert.equal(categoryForType("some_future_type"), null);
});

test("known types resolve to their domain", () => {
  assert.equal(categoryForType("shipped"), "shipping");
  assert.equal(categoryForType("deposit_paid"), "payments");
  assert.equal(categoryForType("qc_complete"), "production");
  assert.equal(categoryForType("consultation_reminder"), "consultations");
  assert.equal(categoryForType("review_request"), "reviews");
});

test("order-ish categories deep-link to the specific order", () => {
  for (const category of ["orders", "payments", "production", "shipping"]) {
    assert.equal(linkForNotification(category, "abc-123"), "/account/orders/abc-123");
  }
});

test("without an entity id the link points at the section, not a broken URL", () => {
  assert.equal(linkForNotification("orders"), "/account/orders");
  assert.equal(linkForNotification("orders", null), "/account/orders");
});

test("consultations link to the consultations page regardless of entity", () => {
  assert.equal(linkForNotification("consultations"), "/account/consultations");
  assert.equal(linkForNotification("consultations", "abc"), "/account/consultations");
});

test("a null category produces no link", () => {
  assert.equal(linkForNotification(null), null);
  assert.equal(linkForNotification(null, "abc"), null);
});

test("isNotificationCategory rejects near-misses", () => {
  assert.equal(isNotificationCategory("order"), false, "singular is not a category");
  assert.equal(isNotificationCategory("Orders"), false, "case matters");
  assert.equal(isNotificationCategory(""), false);
});

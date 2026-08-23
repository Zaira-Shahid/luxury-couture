// Unit tests for lib/storage/validate-file.ts.
//
// This is CLIENT-SIDE feedback only. The real limits are enforced by the
// Supabase bucket policy (0025), and these tests assert the mirror agrees
// with those numbers — a client check that is more permissive than the
// server produces a confusing failed upload instead of a clear message.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_MEDIA_BYTES,
  validateImageFile,
} from "../../src/lib/storage/validate-file.ts";

/** Minimal File stand-in — only type and size are read. */
function fakeFile(type, size) {
  return { type, size, name: "x" };
}

test("the limits match the bucket policy in 0025", () => {
  assert.equal(MAX_IMAGE_BYTES, 5 * 1024 * 1024);
  assert.equal(MAX_MEDIA_BYTES, 10 * 1024 * 1024);
});

test("allowed image types are accepted", () => {
  for (const type of ALLOWED_IMAGE_TYPES) {
    assert.equal(validateImageFile(fakeFile(type, 1024)), null, type);
  }
});

test("a non-image type is rejected", () => {
  for (const type of ["application/pdf", "text/html", "application/javascript", ""]) {
    assert.ok(validateImageFile(fakeFile(type, 1024)), type);
  }
});

test("an SVG is rejected", () => {
  // Deliberate: SVG is executable markup, so accepting it into a bucket
  // served on our own origin would be a stored-XSS vector.
  assert.ok(validateImageFile(fakeFile("image/svg+xml", 1024)));
});

test("a file at exactly the limit is accepted", () => {
  assert.equal(validateImageFile(fakeFile("image/jpeg", MAX_IMAGE_BYTES)), null);
});

test("a file one byte over the limit is rejected", () => {
  assert.ok(validateImageFile(fakeFile("image/jpeg", MAX_IMAGE_BYTES + 1)));
});

test("the size limit is configurable per bucket", () => {
  const eightMb = 8 * 1024 * 1024;
  assert.ok(validateImageFile(fakeFile("image/jpeg", eightMb)), "over the 5MB default");
  assert.equal(
    validateImageFile(fakeFile("image/jpeg", eightMb), MAX_MEDIA_BYTES),
    null,
    "under the 10MB media limit"
  );
});

test("the too-large message names the actual limit", () => {
  assert.match(validateImageFile(fakeFile("image/jpeg", MAX_IMAGE_BYTES + 1)), /5MB/);
  assert.match(
    validateImageFile(fakeFile("image/jpeg", MAX_MEDIA_BYTES + 1), MAX_MEDIA_BYTES),
    /10MB/
  );
});

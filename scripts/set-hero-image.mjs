/**
 * Uploads one local photograph and makes it the homepage hero backdrop.
 *
 *   node --env-file=.env.local scripts/set-hero-image.mjs <path-to-image>
 *   node --env-file=.env.local scripts/set-hero-image.mjs --clear
 *
 * WHY A DEDICATED COPY rather than reusing the product photo's URL.
 * The chosen image is currently also Layla Saffron Sharara's catalogue
 * shot. Pointing the hero at that same object would silently couple the
 * two: re-running the photo seeder, or the owner swapping Layla's picture
 * in the admin, would change the front page as a side effect. A separate
 * object under `branding/` costs one file and removes that coupling
 * entirely.
 *
 * It is uploaded to Supabase Storage rather than referenced anywhere
 * else, for the reason established in Module 31: Module 28's
 * next.config remotePatterns and Module 29's CSP both allow the Supabase
 * host only, so an external URL fails twice over.
 *
 * A `media` row is written alongside the object so the image appears in
 * the Module 8 Media Library and can be managed there like any other
 * asset — an orphaned storage object would be invisible to the admin.
 */
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SETTING_KEY = "homepage.hero_image_url";
const BUCKET = "media";
const PREFIX = "branding";

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

/** Writes the settings row, matching how the homepage admin screen stores it. */
async function setSetting(value) {
  const { data: existing } = await admin
    .from("site_settings")
    .select("id")
    .eq("key", SETTING_KEY)
    .maybeSingle();

  if (existing) {
    await admin.from("site_settings").update({ value }).eq("id", existing.id);
  } else {
    await admin.from("site_settings").insert({ key: SETTING_KEY, value });
  }
}

const arg = process.argv[2];
if (!arg) {
  console.error("usage: set-hero-image.mjs <path-to-image> | --clear");
  process.exit(1);
}

if (arg === "--clear") {
  await setSetting(null);
  console.log("Hero image cleared — the homepage falls back to its gradient.");
  process.exit(0);
}

const ext = extname(arg).toLowerCase();
if (!CONTENT_TYPES[ext]) {
  console.error(`unsupported image type: ${ext || "(none)"}`);
  process.exit(1);
}
// Always re-encoded as JPEG below, whatever went in.
const contentType = "image/jpeg";

const original = await readFile(arg);

// RESIZE BEFORE UPLOAD. The source is a 4000x6000 studio file at 2.6 MB.
// The hero renders it as a CSS `background-image` — which next/image
// never touches, so none of Module 28's automatic optimisation applies
// here — and then covers it with a 60% overlay. Shipping the full file
// would put multiple megabytes in front of the site's LCP element for no
// visible gain. 2000px wide covers a 2x retina desktop viewport; the
// blur from the overlay hides the rest.
//
// `sharp` is already a dependency (Next uses it for image optimisation),
// so this adds nothing to the install.
const buffer = await sharp(original)
  .resize({ width: 2000, withoutEnlargement: true })
  .jpeg({ quality: 82, mozjpeg: true })
  .toBuffer();
const meta = await sharp(buffer).metadata();
// A fixed object name, so re-running this replaces the hero rather than
// accumulating one dead object per change.
const path = `${PREFIX}/hero.jpg`;

const { error: uploadError } = await admin.storage
  .from(BUCKET)
  .upload(path, buffer, { contentType, upsert: true });
if (uploadError) {
  console.error(`upload failed — ${uploadError.message}`);
  process.exit(1);
}

const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path);
// Cache-bust: the object name is fixed, so without this the browser and
// the CDN would both keep serving the previous hero after a swap.
const url = `${publicUrl.publicUrl}?v=${Date.now()}`;

const altText = "Bridal couture detail — hand embroidery and gold work";
const { data: existingMedia } = await admin
  .from("media")
  .select("id")
  .eq("storage_path", path)
  .maybeSingle();

const mediaRow = {
  storage_path: path,
  url: publicUrl.publicUrl,
  file_type: contentType,
  size_bytes: buffer.length,
  alt_text: altText,
};
if (existingMedia) {
  await admin.from("media").update(mediaRow).eq("id", existingMedia.id);
} else {
  await admin.from("media").insert(mediaRow);
}

await setSetting(url);

console.log(
  `Uploaded  ${basename(arg)}  ${(original.length / 1024 / 1024).toFixed(1)} MB ` +
    `-> ${(buffer.length / 1024).toFixed(0)} KB at ${meta.width}x${meta.height}`
);
console.log(`Storage   ${BUCKET}/${path}`);
console.log(`Hero URL  ${url}`);

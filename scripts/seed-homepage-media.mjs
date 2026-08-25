// Real imagery for the three homepage sections that were still showing
// generated gradients: Our Craft, Featured Collections and Follow Along.
//
//   node --env-file=.env.local scripts/seed-homepage-media.mjs --seed
//   node --env-file=.env.local scripts/seed-homepage-media.mjs --status
//
// WHERE THE PICTURES COME FROM, and why they differ per section:
//
//   Our Craft          — one sourced photograph (Pexels): hands mid-stitch,
//                        setting pearls, crystals and gold thread into a
//                        bridal neckline. The section copy claims hand
//                        embroidery by in-house artisans, so the image has
//                        to show the WORK HAPPENING. Two alternatives were
//                        rejected for that reason: a flat-lay of finished
//                        gold cord on red silk (beautiful, but nobody is
//                        working) and a shot of the same craft in a
//                        non-South-Asian tradition, which does not match
//                        the zardozi/gota/dabka the copy names.
//
//   Collection covers  — a product photograph from INSIDE each
//                        collection. Not sourced stock: a cover that
//                        shows a piece you cannot then buy is a small
//                        lie, and the catalogue already has the right
//                        picture for each one.
//
//   Follow Along       — six of the shop's own catalogue photographs,
//                        written into `social_gallery_images` (0039).
//                        That table is the designed source for this
//                        section and is editable in the admin; it simply
//                        still held the six generated gradients the demo
//                        seeder put there. Each tile links to its
//                        product.
//
// Everything is re-hosted on Supabase Storage. Nothing is hotlinked —
// Module 28's remotePatterns and Module 29's CSP both allow the Supabase
// host only.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BUCKET = "media";
const mode = process.argv.find((a) => a.startsWith("--")) ?? "--status";

/** The Our Craft photograph, already downloaded and viewed. */
const CRAFT_SOURCE = ".craft/our-craft.jpg";
const CRAFT_ALT =
  "An artisan stitching pearls, crystals and gold thread onto a bridal neckline by hand";
const CRAFT_SETTING = "homepage.craft_image_url";

/**
 * The admin panel backdrop, supplied by the owner.
 *
 * A bride in deep red velvet and gold zardozi holding a lit diya, shot
 * against near-black. Deliberately NOT the homepage hero — the two
 * screens should not look like the same page.
 *
 * It is a DARK image behind a LIGHT theme, which is why the layout pairs
 * it with translucent-but-blurred sidebar and topbar surfaces rather than
 * letting the nav sit straight on it.
 */
const ADMIN_BG_SOURCE = ".craft/admin-bg.jpg";
const ADMIN_BG_SETTING = "branding.admin_background_url";

/**
 * Which product's photograph fronts each collection.
 *
 * Chosen by eye from pieces that are actually IN that collection, so the
 * cover is never advertising something the collection does not contain.
 */
const COLLECTION_COVERS = {
  "bridal-couture": "amrita-crimson-bridal-lehenga",
  "mehndi-and-mayoun": "mahira-sunflower-mehndi-lehenga",
  "reception-evening": "sabeen-peacock-velvet-reception-lehenga",
  "ready-to-wear": "areeba-ochre-chikankari-kurta",
};

/** The six pieces shown in the Follow Along grid, in order. */
const GALLERY_SLUGS = [
  "nayab-marigold-mehndi-lehenga",
  "warda-pearl-grey-zardozi-lehenga",
  "ambreen-teal-gharara",
  "meherbano-crimson-nikkah-lehenga",
  "rida-rose-chanderi-anarkali",
  "celeste-ivory-cathedral-train-gown",
];


/**
 * Writes one settings row.
 *
 * A PLAIN UPSERT ON `key`, because site_settings has no `id` column —
 * `key` is itself the primary key (0012). The previous version here read
 * `.select("id")`, which errors; the error was not checked, so `existing`
 * came back null, the code took the insert branch, and the insert then
 * failed on the duplicate key. Silently. The net effect was that the
 * first write for a key worked and EVERY LATER ONE DID NOTHING, which is
 * why the owner swapped the admin backdrop repeatedly and kept seeing the
 * original picture.
 *
 * The error is thrown now rather than ignored.
 */
async function setSetting(key, value) {
  const { error } = await admin
    .from("site_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(`setting ${key}: ${error.message}`);
}

/**
 * Resize, upload, write a media row, return the public URL.
 *
 * `storageStem` is a STEM, not the final name: an 8-character hash of
 * the encoded bytes is appended before the extension.
 *
 * WHY. These were previously written to a fixed name with a `?v=`
 * timestamp on the stored URL to bust caches. It does not work — the
 * owner swapped the admin backdrop and kept seeing the previous picture,
 * even though the object in Storage was verifiably the new one. A query
 * string is not part of the cache key everywhere it needs to be.
 *
 * Hashing the CONTENT into the filename means different bytes are always
 * a different URL, so no cache anywhere can serve a stale image, and
 * re-running with an unchanged file is a genuine no-op rather than a
 * pointless new version. Superseded objects are left in the bucket; they
 * are small, and deleting one still referenced by an older settings row
 * would break that page instead.
 */
async function upload(sourcePath, storageStem, altText, width) {
  const original = await readFile(sourcePath);
  // Same reasoning as the hero: these render through next/image at known
  // display sizes, and shipping a 4000px original would put megabytes on
  // the homepage for no visible gain.
  const buffer = await sharp(original)
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 8);
  const storagePath = storageStem.replace(/\.jpg$/, `-${hash}.jpg`);

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`${storagePath}: ${error.message}`);

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
  const row = {
    storage_path: storagePath,
    url: pub.publicUrl,
    file_type: "image/jpeg",
    size_bytes: buffer.length,
    alt_text: altText,
  };
  const { data: existing } = await admin
    .from("media")
    .select("id")
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (existing) await admin.from("media").update(row).eq("id", existing.id);
  else await admin.from("media").insert(row);

  return { url: pub.publicUrl, bytes: buffer.length };
}

async function seed() {
  // -------------------------------------------------------------------
  console.log("Our Craft");
  if (!existsSync(CRAFT_SOURCE)) {
    console.log(`  ! ${CRAFT_SOURCE} missing — skipped`);
  } else {
    const { url, bytes } = await upload(
      CRAFT_SOURCE,
      "branding/our-craft.jpg",
      CRAFT_ALT,
      1200
    );
    await setSetting(CRAFT_SETTING, url);
    console.log(`  + ${url.split("/").pop()} (${(bytes / 1024).toFixed(0)} KB)`);
    console.log(`    ${CRAFT_ALT}`);
  }

  // -------------------------------------------------------------------
  console.log("\nAdmin panel backdrop");
  if (!existsSync(ADMIN_BG_SOURCE)) {
    console.log(`  ! ${ADMIN_BG_SOURCE} missing — skipped`);
  } else {
    const { url, bytes } = await upload(
      ADMIN_BG_SOURCE,
      "branding/admin-background.jpg",
      "A bride in red and gold bridal dress holding a lit diya",
      2000
    );
    await setSetting(ADMIN_BG_SETTING, url);
    console.log(`  + ${url.split("/").pop()} (${(bytes / 1024).toFixed(0)} KB)`);
  }

  // -------------------------------------------------------------------
  console.log("\nFeatured Collections — covers");
  for (const [collectionSlug, productSlug] of Object.entries(COLLECTION_COVERS)) {
    const { data: collection } = await admin
      .from("collections")
      .select("id, name")
      .eq("slug", collectionSlug)
      .maybeSingle();
    if (!collection) {
      console.log(`  ! ${collectionSlug}: no such collection`);
      continue;
    }
    const { data: product } = await admin
      .from("products")
      .select("id, name, product_images(url, is_primary)")
      .eq("slug", productSlug)
      .maybeSingle();
    const image =
      product?.product_images?.find((i) => i.is_primary) ?? product?.product_images?.[0];
    if (!image) {
      console.log(`  ! ${collectionSlug}: ${productSlug} has no image`);
      continue;
    }
    // Point at the product's existing Storage object rather than
    // duplicating the file: covers and product cards showing the same
    // picture is correct here, and one object cannot drift from the
    // other.
    await admin
      .from("collections")
      .update({ cover_image_url: image.url, is_featured: true })
      .eq("id", collection.id);
    console.log(`  + ${collection.name}  <-  ${product.name}`);
  }

  // -------------------------------------------------------------------
  console.log("\nFollow Along — six catalogue photographs");
  const tiles = [];
  for (const slug of GALLERY_SLUGS) {
    const { data: product } = await admin
      .from("products")
      .select("name, slug, product_images(url, alt_text, is_primary)")
      .eq("slug", slug)
      .maybeSingle();
    const image =
      product?.product_images?.find((i) => i.is_primary) ?? product?.product_images?.[0];
    if (!image) {
      console.log(`  ! ${slug}: no image`);
      continue;
    }
    tiles.push({
      imageUrl: image.url,
      caption: product.name,
      href: `/products/${product.slug}`,
    });
    console.log(`  + ${product.name}`);
  }
  // Replace the table's contents rather than appending, so re-running
  // never leaves the old gradients sitting behind the new photographs.
  await admin.from("social_gallery_images").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("social_gallery_images").insert(
    tiles.map((t, i) => ({
      image_url: t.imageUrl,
      caption: t.caption,
      link_url: t.href,
      sort_order: i,
      is_active: true,
    }))
  );
  console.log(`  ${tiles.length}/6 tiles written to social_gallery_images`);
}

async function status() {
  for (const key of [CRAFT_SETTING, ADMIN_BG_SETTING, "homepage.hero_image_url"]) {
    const { data } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    const v = data?.value;
    console.log(`${key.padEnd(28)} ${v ? `set (${String(v).length} chars)` : "NOT SET"}`);
  }
  const { data: collections } = await admin
    .from("collections")
    .select("name, is_featured, cover_image_url")
    .eq("is_active", true);
  console.log("\ncollections:");
  for (const c of collections ?? []) {
    console.log(
      `  featured=${String(c.is_featured).padEnd(5)} cover=${c.cover_image_url ? "yes" : "NO "}  ${c.name}`
    );
  }
}

if (mode === "--seed") await seed();
else await status();

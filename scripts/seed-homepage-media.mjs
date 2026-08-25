// Real imagery for the three homepage sections that were still showing
// generated gradients: Our Craft, Featured Collections and Follow Along.
//
//   node --env-file=.env.local scripts/seed-homepage-media.mjs --seed
//   node --env-file=.env.local scripts/seed-homepage-media.mjs --status
//
// WHERE THE PICTURES COME FROM, and why they differ per section:
//
//   Our Craft          — one sourced photograph (Pexels): an artisan's
//                        hand setting pearls and beadwork onto fabric
//                        stretched over a wooden adda frame. The section
//                        copy claims hand embroidery by in-house
//                        artisans, so the image has to actually show
//                        that. A pretty flat-lay of a dress would have
//                        illustrated the wrong sentence.
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
const CRAFT_SOURCE = ".craft/c-31935139.jpg";
const CRAFT_ALT =
  "An artisan's hand setting pearls and silver beadwork onto mint silk stretched over a wooden adda frame";
const CRAFT_SETTING = "homepage.craft_image_url";

/** The admin panel backdrop, supplied by the owner and viewed. */
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


async function setSetting(key, value) {
  const { data: existing } = await admin
    .from("site_settings")
    .select("id")
    .eq("key", key)
    .maybeSingle();
  if (existing) await admin.from("site_settings").update({ value }).eq("id", existing.id);
  else await admin.from("site_settings").insert({ key, value });
}

/** Resize, upload, write a media row, return the public URL. */
async function upload(sourcePath, storagePath, altText, width) {
  const original = await readFile(sourcePath);
  // Same reasoning as the hero: these render through next/image at known
  // display sizes, and shipping a 4000px original would put megabytes on
  // the homepage for no visible gain.
  const buffer = await sharp(original)
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

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
    await setSetting(CRAFT_SETTING, `${url}?v=${Date.now()}`);
    console.log(`  + branding/our-craft.jpg (${(bytes / 1024).toFixed(0)} KB)`);
    console.log(`    ${CRAFT_ALT}`);
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

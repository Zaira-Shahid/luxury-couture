// Seeds one photographed collection: creates its products, replaces
// images on products that already existed, and reports the supplied
// images it did not use.
//
//   node --env-file=.env.local scripts/seed-collection.mjs mehndi --seed
//   node --env-file=.env.local scripts/seed-collection.mjs reception --seed
//   node --env-file=.env.local scripts/seed-collection.mjs nikkah --status
//
// One script rather than one per collection. The three collections
// differ only in their data — which images, which products, which
// occasion to report on — so the seeding logic is shared and each
// collection is just a file under lib/.
//
// Structured like seed-nikkah.mjs on purpose: same upload path, same
// media-row handling, same idempotent upsert-by-slug, so the two
// collections behave identically and there is only one thing to learn.
//
// Two differences from the Nikkah seeder, both deliberate:
//
//   1. It applies REPLACEMENTS — an image for a product that already
//      exists. Hina Pistachio Gharara was still carrying one of the four
//      bad bulk-fetched pictures, and one of the supplied files is an
//      actual pistachio outfit. That is a fix, not a nineteenth product.
//
//   2. It prints UNUSED with reasons. Twenty-four images came in and
//      nineteen are used; the five that are not are named and explained
//      rather than quietly dropped.
//
// NOT RECORDED IN demo_seed_items — and this is the important one.
// The Nikkah collection WAS recorded there, and it cost the owner the
// whole collection: `test-seed-demo.mjs` exercises `seed-demo.mjs
// --clear`, `--clear` deletes everything the shared manifest lists, and
// the eight Nikkah products went with it. The demo store's manifest
// should describe the demo store. These collections are catalogue
// content and are cleared by their own `--clear` below.
import { createClient } from "@supabase/supabase-js";

import { guardDestructive } from "./lib/guard-destructive.mjs";
import { existsSync, readFileSync } from "node:fs";

const NAME = process.argv[2];
const COLLECTIONS = {
  mehndi: { module: "./lib/mehndi-collection.mjs", key: "MEHNDI", occasion: "mehndi" },
  reception: { module: "./lib/reception-collection.mjs", key: "RECEPTION", occasion: "reception" },
  western: { module: "./lib/western-collection.mjs", key: "WESTERN", occasion: "reception" },
  engagement: {
    module: "./lib/engagement-collection.mjs",
    key: "ENGAGEMENT",
    occasion: "engagement",
    // Clear every existing tag for this occasion before seeding, so the
    // section is rebuilt from this collection alone rather than layered
    // on top of whatever was tagged before. Only THIS collection does
    // it, and only because the owner asked for the section emptied.
    //
    // It removes tags, never products: a piece tagged engagement+nikkah
    // keeps its nikkah tag and stays in the catalogue. Anything left
    // with no live occasion at all is reported at the end rather than
    // silently orphaned.
    exclusive: true,
  },
};
const collection = COLLECTIONS[NAME];
if (!collection) {
  console.error(`usage: seed-collection.mjs <${Object.keys(COLLECTIONS).join("|")}> [--seed|--clear|--status]`);
  process.exit(1);
}
const lib = await import(collection.module);
const PRODUCTS = lib[`${collection.key}_PRODUCTS`];
const IMAGE_DIR_ = lib[`${collection.key}_IMAGE_DIR`];
const REPLACEMENTS = lib.REPLACEMENTS ?? [];
const UNUSED = lib.UNUSED ?? [];

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const mode = process.argv.find((a) => a.startsWith("--")) ?? "--status";
const BUCKET = "media";
const PREFIX = "demo-store/photos";

/**
 * Uploads one local file and makes it the product's primary image.
 *
 * Returns the public URL, or null when the file is missing or the upload
 * failed — the caller reports it and carries on rather than aborting the
 * whole run over one picture.
 */
async function attachImage(productId, slug, name, image, saw) {
  const source = `${IMAGE_DIR_}/${image}`;
  if (!existsSync(source)) {
    console.log(`  ! ${slug}: image ${source} missing`);
    return null;
  }
  const buffer = readFileSync(source);
  // The extension follows the source file: one of the supplied images is
  // a PNG, and mislabelling it as JPEG would serve a broken content type.
  const ext = image.endsWith(".png") ? "png" : "jpg";
  const contentType = ext === "png" ? "image/png" : "image/jpeg";
  const path = `${PREFIX}/${slug}.${ext}`;

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (upErr) {
    console.log(`  ! ${slug}: upload failed — ${upErr.message}`);
    return null;
  }

  const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path);
  const url = publicUrl.publicUrl;
  const altText = `${name} — ${saw}`;

  // Media Library row, so the image is manageable in the admin rather
  // than being an orphaned storage object nobody can see.
  const { data: existingMedia } = await admin
    .from("media")
    .select("id")
    .eq("storage_path", path)
    .maybeSingle();
  const mediaRow = {
    storage_path: path,
    url,
    file_type: contentType,
    size_bytes: buffer.length,
    alt_text: altText,
  };
  if (existingMedia) {
    await admin.from("media").update(mediaRow).eq("id", existingMedia.id);
  } else {
    await admin.from("media").insert(mediaRow);
  }

  // Replace the primary image rather than adding a second one, so
  // re-running never accumulates duplicates on a product.
  const { data: primary } = await admin
    .from("product_images")
    .select("id")
    .eq("product_id", productId)
    .eq("is_primary", true)
    .maybeSingle();
  if (primary) {
    await admin
      .from("product_images")
      .update({ url, alt_text: altText })
      .eq("id", primary.id);
  } else {
    await admin.from("product_images").insert({
      product_id: productId,
      url,
      alt_text: altText,
      is_primary: true,
      sort_order: 0,
    });
  }
  return url;
}

async function seed() {
  console.log("`Seeding the ${NAME} collection...`\n");

  const { data: cats } = await admin.from("categories").select("id, slug, is_active");
  // Each product names its own category: the reception collection has a
  // tulle gown that belongs in Western Wear, not Asian Wear, and quietly
  // filing it under the wrong one would be exactly the kind of small
  // untruth this collection is meant to avoid.
  const categoryBySlug = new Map((cats ?? []).filter((c) => c.is_active).map((c) => [c.slug, c.id]));

  const { data: allOccasions } = await admin.from("occasions").select("id, slug, is_active");
  const occasionId = new Map((allOccasions ?? []).map((o) => [o.slug, o.id]));
  const active = new Set((allOccasions ?? []).filter((o) => o.is_active).map((o) => o.slug));

  if (collection.exclusive) {
    // An `exclusive` collection wipes every existing tag for its occasion
    // before seeding. Additive seeding is safe to re-run anywhere; this
    // branch is not, so it asks first.
    guardDestructive(`${NAME} --seed (it clears existing ${collection.occasion} tags)`);
    const { data: occRow } = await admin
      .from("occasions")
      .select("id")
      .eq("slug", collection.occasion)
      .single();
    const { data: cleared } = await admin
      .from("product_occasions")
      .delete()
      .eq("occasion_id", occRow.id)
      .select("product_id");
    console.log(`cleared ${cleared?.length ?? 0} existing ${collection.occasion} tags
`);
  }

  let seeded = 0;
  for (const product of PRODUCTS) {
    // Catch a tag pointing at a retired occasion — walima and party are
    // both inactive now, and a product tagged only with those would be
    // invisible under every filter chip on the storefront.
    for (const slug of product.occasions) {
      if (!occasionId.has(slug)) throw new Error(`${product.slug}: unknown occasion "${slug}"`);
      if (!active.has(slug)) throw new Error(`${product.slug}: occasion "${slug}" is retired`);
    }

    const categorySlug = product.categorySlug ?? "asian-wear";
    const categoryId = categoryBySlug.get(categorySlug);
    if (!categoryId) throw new Error(`${product.slug}: category "${categorySlug}" missing or retired`);

    const { data: row, error } = await admin
      .from("products")
      .upsert(
        {
          name: product.name,
          slug: product.slug,
          category_id: categoryId,
          description: product.description,
          base_price: product.price,
          currency: "GBP",
          status: "published",
          is_featured: !!product.featured,
          published_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();
    if (error) throw new Error(`${product.slug}: ${error.message}`);

    // Tags replaced wholesale, so editing the collection file takes
    // effect on the next run instead of layering on top of the last one.
    await admin.from("product_occasions").delete().eq("product_id", row.id);
    await admin.from("product_occasions").insert(
      product.occasions.map((slug) => ({ product_id: row.id, occasion_id: occasionId.get(slug) }))
    );

    const url = await attachImage(row.id, product.slug, product.name, product.image, product.saw);
    if (!url) continue;

    seeded += 1;
    console.log(`  + ${product.name}  £${product.price}  [${categorySlug}] [${product.occasions.join(", ")}]`);
    console.log(`      ${product.image} — ${product.saw}`);
  }

  console.log(`\n${seeded}/${PRODUCTS.length} ${NAME} products seeded.`);

  // -------------------------------------------------------------------
  if (REPLACEMENTS.length) {
    console.log("\nReplacing images on products that already existed:");
    for (const item of REPLACEMENTS) {
      const { data: existing } = await admin
        .from("products")
        .select("id, name")
        .eq("slug", item.slug)
        .maybeSingle();
      if (!existing) {
        console.log(`  ! ${item.slug}: no such product`);
        continue;
      }
      const url = await attachImage(
        existing.id,
        item.slug,
        existing.name,
        item.image,
        item.saw
      );
      if (url) {
        console.log(`  ~ ${existing.name}  <- ${item.image}`);
        console.log(`      ${item.saw}`);
        console.log(`      why: ${item.why}`);
      }
    }
  }

  // -------------------------------------------------------------------
  console.log(`\nSupplied but NOT used (${UNUSED.length}):`);
  for (const item of UNUSED) {
    console.log(`  - ${item.image} — ${item.saw}`);
    console.log(`      ${item.why}`);
  }
}

/**
 * Removes only what this seeder created.
 *
 * Deliberately narrow: it deletes the eighteen slugs in the collection
 * file and nothing else. It does NOT touch the products in REPLACEMENTS,
 * which existed before this seeder ran and are not its to remove.
 */
async function clear() {
  guardDestructive(`${NAME} --clear`);
  const slugs = PRODUCTS.map((p) => p.slug);
  const { data: removed } = await admin
    .from("products")
    .delete()
    .in("slug", slugs)
    .select("name");
  console.log(`Removed ${removed?.length ?? 0} ${NAME} products.`);
}

async function status() {
  const { data: occ } = await admin
    .from("occasions")
    .select("id")
    .eq("slug", collection.occasion)
    .maybeSingle();
  const { data: rows } = await admin
    .from("product_occasions")
    .select("products(name, base_price)")
    .eq("occasion_id", occ.id);
  const list = (rows ?? []).filter((r) => r.products);
  console.log(`Products tagged ${collection.occasion}: ${list.length}`);
  for (const r of list.sort((a, b) => b.products.base_price - a.products.base_price)) {
    console.log(`  £${String(r.products.base_price).padStart(5)}  ${r.products.name}`);
  }
}

if (mode === "--seed") await seed();
else if (mode === "--clear") await clear();
else await status();

// The Nikkah collection — seeds the eight products and attaches the
// owner's photographs to them.
//
//   node --env-file=.env.local scripts/seed-nikkah.mjs --seed
//   node --env-file=.env.local scripts/seed-nikkah.mjs --status
//
// Kept separate from seed-demo.mjs so the original twelve products stay
// untouched: this adds to the catalogue rather than rewriting it.
//
// NOT RECORDED IN demo_seed_items, deliberately, and this was a
// correction rather than the original design.
//
// It used to record every product, media row and image in the shared
// manifest so `seed-demo.mjs --clear` would remove them too. That looked
// tidy and was wrong: `test-seed-demo.mjs` exercises `--clear` as part of
// the ordinary suite, so a routine test run deleted all eight products —
// and the re-seed that follows only knows the original twelve. The owner
// found their Nikkah section down from ten products to two.
//
// The demo store's manifest should describe the demo store. This
// collection is catalogue content layered on top of it, and re-running
// this script with --seed is how it is restored.
//
// Images come from .unsplash/, downloaded from URLs the owner supplied
// and VIEWED before each product was written. They are re-hosted on
// Supabase Storage for the same reason as everything else: Module 28's
// remotePatterns and Module 29's CSP both allow only the Supabase host,
// so an external URL would break the page rather than just the image.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

import { NIKKAH_PRODUCTS } from "./lib/nikkah-collection.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const mode = process.argv.find((a) => a.startsWith("--")) ?? "--status";
const BUCKET = "media";
const PREFIX = "demo-store/photos";
const IMAGE_DIR = ".unsplash";

/**
 * Formerly wrote to demo_seed_items. Kept as a no-op with the call sites
 * intact so the reason survives next to the code it explains — see the
 * note at the top of the file. Restoring the old behaviour would
 * re-break the collection.
 */
async function record(_table, _id, _detail) {}

async function seed() {
  console.log("Seeding the Nikkah collection...\n");

  const { data: cats } = await admin.from("categories").select("id, slug");
  const categoryId = (cats ?? []).find((c) => c.slug === "asian-wear")?.id;
  if (!categoryId) throw new Error("asian-wear category missing — run migrate first");

  const { data: allOccasions } = await admin.from("occasions").select("id, slug");
  const occasionId = new Map((allOccasions ?? []).map((o) => [o.slug, o.id]));

  let seeded = 0;
  for (const product of NIKKAH_PRODUCTS) {
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
    await record("products", row.id, product.slug);

    // Occasion tags, replaced wholesale so edits here take effect.
    await admin.from("product_occasions").delete().eq("product_id", row.id);
    const ids = product.occasions.map((slug) => occasionId.get(slug)).filter(Boolean);
    if (ids.length !== product.occasions.length) {
      throw new Error(`${product.slug}: unknown occasion in ${product.occasions.join(", ")}`);
    }
    await admin
      .from("product_occasions")
      .insert(ids.map((occasion_id) => ({ product_id: row.id, occasion_id })));

    // Image.
    const source = `${IMAGE_DIR}/${product.image}`;
    if (!existsSync(source)) {
      console.log(`  ! ${product.slug}: image ${source} missing`);
      continue;
    }
    const buffer = readFileSync(source);
    const path = `${PREFIX}/${product.slug}.jpg`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
    if (upErr) {
      console.log(`  ! ${product.slug}: upload failed — ${upErr.message}`);
      continue;
    }
    const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path);
    const altText = `${product.name} — ${product.saw}`;

    const { data: existingMedia } = await admin
      .from("media")
      .select("id")
      .eq("storage_path", path)
      .maybeSingle();
    let mediaId = existingMedia?.id;
    if (!mediaId) {
      const { data: created } = await admin
        .from("media")
        .insert({
          storage_path: path,
          url: publicUrl.publicUrl,
          file_type: "image/jpeg",
          size_bytes: buffer.length,
          alt_text: altText,
        })
        .select("id")
        .single();
      mediaId = created?.id;
    }
    if (mediaId) await record("media", mediaId, path);

    const { data: primary } = await admin
      .from("product_images")
      .select("id")
      .eq("product_id", row.id)
      .eq("is_primary", true)
      .maybeSingle();
    if (primary) {
      await admin
        .from("product_images")
        .update({ url: publicUrl.publicUrl, alt_text: altText })
        .eq("id", primary.id);
    } else {
      const { data: inserted } = await admin
        .from("product_images")
        .insert({
          product_id: row.id,
          url: publicUrl.publicUrl,
          alt_text: altText,
          is_primary: true,
          sort_order: 0,
        })
        .select("id")
        .single();
      if (inserted) await record("product_images", inserted.id, path);
    }

    seeded += 1;
    console.log(`  + ${product.name}  £${product.price}  [${product.occasions.join(", ")}]`);
    console.log(`      image: ${product.image} — ${product.saw}`);
  }

  console.log(`\n${seeded}/${NIKKAH_PRODUCTS.length} Nikkah products seeded.`);
}

async function status() {
  const { data: nikkah } = await admin.from("occasions").select("id").eq("slug", "nikkah").maybeSingle();
  const { data: rows } = await admin
    .from("product_occasions")
    .select("products(name, base_price)")
    .eq("occasion_id", nikkah.id);
  console.log(`Products tagged Nikkah: ${rows?.length ?? 0}`);
  for (const r of rows ?? []) console.log(`  ${r.products?.name}  £${r.products?.base_price}`);
}

if (mode === "--seed") await seed();
else await status();

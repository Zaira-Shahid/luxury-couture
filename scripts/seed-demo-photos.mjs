// Module 31 addendum — real photography for the demo store.
//
//   node --env-file=.env.local scripts/seed-demo-photos.mjs --fetch
//   node --env-file=.env.local scripts/seed-demo-photos.mjs --status
//   node --env-file=.env.local scripts/seed-demo-photos.mjs --revert
//
// Replaces the locally-generated gradient placeholders on the demo
// products with real bridal photography sourced from Pexels.
//
// WHY THE IMAGES ARE RE-HOSTED RATHER THAN HOTLINKED. Two of this
// project's own earlier decisions make an external URL unusable:
//
//   * Module 28 set next.config.mjs `remotePatterns` to the Supabase host
//     only, so next/image THROWS on any other host — taking the page
//     down, not just the image.
//   * Module 29 shipped a CSP with `img-src 'self' data: blob:
//     https://<supabase>`, so an external image is blocked outright.
//
// So every photo is downloaded, validated, uploaded to Supabase Storage
// and recorded in the `media` table — which also means it appears in the
// admin Media Library, exactly as an admin upload would.
//
// IT GOES THROUGH THE SAME PATH uploadMedia() uses (uploadToStorage +
// a media row), rather than calling that Server Action over HTTP. The
// action requires a signed-in admin session and returns a redirect-shaped
// result; driving it from a seed script would add a session dance without
// changing the outcome by a single row. The storage object and the media
// row are identical either way.
//
// EVERYTHING IS TRACKED in demo_seed_items, so `seed-demo.mjs --clear`
// removes these too, and --revert here restores the gradients without
// touching anything else.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

import { DEMO_PRODUCTS } from "./lib/demo-content.mjs";
import { LOCAL_PHOTO_MAP, LOCAL_PHOTO_DIR } from "./lib/local-photo-map.mjs";
import { guardDestructive } from "./lib/guard-destructive.mjs";
import { DEMO_PHOTO_QUERIES, downloadPhoto, searchPhotos } from "./lib/fetch-demo-photos.mjs";
import { generatePlaceholderPng } from "./lib/placeholder-image.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const mode = process.argv.find((a) => a.startsWith("--")) ?? "--status";
const STORAGE_BUCKET = "media";
const STORAGE_PREFIX = "demo-store/photos";

async function record(entityTable, entityId, detail) {
  await admin
    .from("demo_seed_items")
    .upsert(
      { entity_table: entityTable, entity_id: entityId, detail },
      { onConflict: "entity_table,entity_id" }
    );
}

// ---------------------------------------------------------------------

async function fetchAndAttach() {
  console.log("Sourcing photography from Pexels...\n");

  // Gather a pool across several queries. One broad query returns
  // visually similar results, and a catalogue where every product looks
  // like the same photograph is worse for judging layout than the
  // obvious placeholders were.
  const pool = [];
  const seenIds = new Set();

  for (const query of DEMO_PHOTO_QUERIES) {
    try {
      const photos = await searchPhotos(query, { perPage: 12 });
      let added = 0;
      for (const photo of photos) {
        if (seenIds.has(photo.id) || !photo.downloadUrl) continue;
        seenIds.add(photo.id);
        pool.push({ ...photo, query });
        added += 1;
      }
      console.log(`  "${query}" -> ${added} new candidate(s)`);
    } catch (error) {
      // One failed query must not lose the whole run.
      console.log(`  ! "${query}": ${error.message}`);
    }
  }

  console.log(`\n  ${pool.length} unique candidates from ${DEMO_PHOTO_QUERIES.length} queries`);

  if (pool.length < DEMO_PRODUCTS.length) {
    console.log(
      `\n! Only ${pool.length} candidates for ${DEMO_PRODUCTS.length} products — some would repeat.`
    );
    if (pool.length === 0) {
      console.log("  Nothing to do. Check PEXELS_API_KEY and the rate limit.");
      process.exit(1);
    }
  }

  // Interleave the queries so adjacent products in the catalogue do not
  // all come from the same search.
  const byQuery = new Map();
  for (const photo of pool) {
    if (!byQuery.has(photo.query)) byQuery.set(photo.query, []);
    byQuery.get(photo.query).push(photo);
  }
  const interleaved = [];
  for (let i = 0; interleaved.length < pool.length; i += 1) {
    for (const photos of byQuery.values()) {
      if (photos[i]) interleaved.push(photos[i]);
    }
    if (i > 50) break;
  }

  console.log("\nDownloading, uploading and attaching...\n");
  let attached = 0;

  for (const [index, product] of DEMO_PRODUCTS.entries()) {
    const photo = interleaved[index % interleaved.length];
    if (!photo) continue;

    const { data: productRow } = await admin
      .from("products")
      .select("id, name")
      .eq("slug", product.slug)
      .maybeSingle();
    if (!productRow) {
      console.log(`  ! ${product.slug}: not seeded — run seed-demo.mjs --seed first`);
      continue;
    }

    let download;
    try {
      download = await downloadPhoto(photo);
    } catch (error) {
      console.log(`  ! ${product.slug}: ${error.message}`);
      continue;
    }

    const extension = download.contentType === "image/png" ? "png" : "jpg";
    const path = `${STORAGE_PREFIX}/${product.slug}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(path, download.buffer, { contentType: download.contentType, upsert: true });
    if (uploadError) {
      console.log(`  ! ${product.slug}: upload failed — ${uploadError.message}`);
      continue;
    }

    const { data: publicUrl } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);

    // The media row is what makes it appear in the admin Media Library.
    // alt_text carries the photographer so attribution is possible even
    // though the Pexels licence does not require it.
    const altText = `${productRow.name} — photograph by ${photo.photographer} (Pexels)`;
    const { data: existingMedia } = await admin
      .from("media")
      .select("id")
      .eq("storage_path", path)
      .maybeSingle();

    let mediaId = existingMedia?.id;
    if (mediaId) {
      await admin
        .from("media")
        .update({
          url: publicUrl.publicUrl,
          file_type: download.contentType,
          size_bytes: download.buffer.length,
          alt_text: altText,
        })
        .eq("id", mediaId);
    } else {
      const { data: created, error: mediaError } = await admin
        .from("media")
        .insert({
          storage_path: path,
          url: publicUrl.publicUrl,
          file_type: download.contentType,
          size_bytes: download.buffer.length,
          alt_text: altText,
        })
        .select("id")
        .single();
      if (mediaError) {
        console.log(`  ! ${product.slug}: media row failed — ${mediaError.message}`);
        continue;
      }
      mediaId = created.id;
    }
    await record("media", mediaId, path);

    // Point the product's primary image at the photograph. The gradient
    // placeholder row is UPDATED rather than replaced, so sort_order and
    // is_primary stay as they were and nothing else has to change.
    const { data: primary } = await admin
      .from("product_images")
      .select("id")
      .eq("product_id", productRow.id)
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
          product_id: productRow.id,
          url: publicUrl.publicUrl,
          alt_text: altText,
          is_primary: true,
          sort_order: 0,
        })
        .select("id")
        .single();
      if (inserted) await record("product_images", inserted.id, path);
    }

    attached += 1;
    console.log(
      `  + ${product.slug} <- "${photo.query}" by ${photo.photographer} (${Math.round(download.buffer.length / 1024)} kB)`
    );
  }

  console.log(`\nDone. ${attached}/${DEMO_PRODUCTS.length} products now have real photography.`);
  console.log("Photographs are re-hosted on Supabase Storage — no external URLs are used.");
}

// ---------------------------------------------------------------------

async function status() {
  const { data: photos } = await admin.storage
    .from(STORAGE_BUCKET)
    .list(STORAGE_PREFIX, { limit: 200 });

  const { data: images } = await admin
    .from("product_images")
    .select("url, alt_text")
    .eq("is_primary", true);

  const real = (images ?? []).filter((i) => i.url?.includes(STORAGE_PREFIX));
  const gradients = (images ?? []).filter((i) => i.url?.includes("demo-store/") && !i.url.includes(STORAGE_PREFIX));

  console.log(`Photographs in storage:      ${photos?.length ?? 0}`);
  console.log(`Products with a photograph:  ${real.length}`);
  console.log(`Products still on a gradient: ${gradients.length}`);
  if (real.length > 0) {
    console.log("\nSample attribution:");
    console.log(`  ${real[0].alt_text}`);
  }
}

// ---------------------------------------------------------------------

async function revert() {
  // --revert DELETES the Storage objects behind every photograph and
  // puts the catalogue back on generated gradients. This is the exact
  // operation that broke the live shop when it ran as part of a suite.
  guardDestructive("--revert");
  console.log("Restoring generated gradients...\n");
  let reverted = 0;

  for (const product of DEMO_PRODUCTS) {
    const { data: productRow } = await admin
      .from("products")
      .select("id")
      .eq("slug", product.slug)
      .maybeSingle();
    if (!productRow) continue;

    const png = generatePlaceholderPng(product.slug, 1200, 1500);
    const path = `demo-store/${product.slug}.png`;
    await admin.storage
      .from(STORAGE_BUCKET)
      .upload(path, png, { contentType: "image/png", upsert: true });
    const { data: publicUrl } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);

    await admin
      .from("product_images")
      .update({ url: publicUrl.publicUrl, alt_text: `${product.name} — placeholder image` })
      .eq("product_id", productRow.id)
      .eq("is_primary", true);
    reverted += 1;
  }

  // Remove the photographs and their media rows.
  const { data: files } = await admin.storage
    .from(STORAGE_BUCKET)
    .list(STORAGE_PREFIX, { limit: 200 });
  if (files?.length) {
    await admin.storage
      .from(STORAGE_BUCKET)
      .remove(files.map((f) => `${STORAGE_PREFIX}/${f.name}`));
  }
  const { data: mediaRows } = await admin
    .from("media")
    .select("id")
    .like("storage_path", `${STORAGE_PREFIX}%`);
  if (mediaRows?.length) {
    const ids = mediaRows.map((m) => m.id);
    await admin.from("media").delete().in("id", ids);
    await admin.from("demo_seed_items").delete().eq("entity_table", "media").in("entity_id", ids);
  }

  console.log(`Done. ${reverted} products back on generated gradients.`);
}

// ---------------------------------------------------------------------

/**
 * Attaches the owner's own photographs, mapped in local-photo-map.mjs.
 *
 * Every one of those was OPENED AND LOOKED AT before being assigned, so
 * this is the trustworthy half of the catalogue: no search heuristic is
 * involved, just a file a human and I both examined.
 */
async function attachLocal() {
  console.log("Attaching owner-supplied photographs...\n");
  let attached = 0;

  for (const [slug, entry] of Object.entries(LOCAL_PHOTO_MAP)) {
    const sourcePath = `${LOCAL_PHOTO_DIR}/${entry.file}`;
    if (!existsSync(sourcePath)) {
      console.log(`  ! ${slug}: not found at ${sourcePath}`);
      continue;
    }

    const { data: productRow } = await admin
      .from("products")
      .select("id, name")
      .eq("slug", slug)
      .maybeSingle();
    if (!productRow) {
      console.log(`  ! ${slug}: product not seeded`);
      continue;
    }

    const buffer = readFileSync(sourcePath);
    const contentType = entry.file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    const extension = contentType === "image/png" ? "png" : "jpg";
    const path = `${STORAGE_PREFIX}/${slug}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, { contentType, upsert: true });
    if (uploadError) {
      console.log(`  ! ${slug}: upload failed — ${uploadError.message}`);
      continue;
    }

    const { data: publicUrl } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    const altText = `${productRow.name} — ${entry.saw}`;

    const { data: existingMedia } = await admin
      .from("media")
      .select("id")
      .eq("storage_path", path)
      .maybeSingle();

    let mediaId = existingMedia?.id;
    if (mediaId) {
      await admin
        .from("media")
        .update({ url: publicUrl.publicUrl, file_type: contentType, size_bytes: buffer.length, alt_text: altText })
        .eq("id", mediaId);
    } else {
      const { data: created } = await admin
        .from("media")
        .insert({
          storage_path: path,
          url: publicUrl.publicUrl,
          file_type: contentType,
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
      .eq("product_id", productRow.id)
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
          product_id: productRow.id,
          url: publicUrl.publicUrl,
          alt_text: altText,
          is_primary: true,
          sort_order: 0,
        })
        .select("id")
        .single();
      if (inserted) await record("product_images", inserted.id, path);
    }

    attached += 1;
    console.log(`  + ${slug}`);
    console.log(`      file: ${entry.file}`);
    console.log(`      shows: ${entry.saw}`);
    console.log(`      why:  ${entry.matches}`);
  }

  console.log(`\n${attached}/${Object.keys(LOCAL_PHOTO_MAP).length} attached from owner uploads.`);
}

if (mode === "--local") await attachLocal();
else if (mode === "--fetch") await fetchAndAttach();
else if (mode === "--revert") await revert();
else await status();

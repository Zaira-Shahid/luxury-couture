/**
 * Gives every builder option a picture.
 *
 *   node --env-file=.env.local scripts/seed-builder-images.mjs --seed
 *   node --env-file=.env.local scripts/seed-builder-images.mjs --status
 *
 * The builder's option tiles fall back to the option's NAME on a grey
 * square when `image_url` is null, and all 22 were null — so every step
 * after Style was a wall of identical blank boxes.
 *
 * TWO SOURCES, ON PURPOSE:
 *
 *   fabrics, embroidery_types  — photographs. The texture IS the thing
 *                                being chosen, and it is what stock
 *                                libraries photograph well. Each file
 *                                below was opened and looked at; `saw`
 *                                records what is in it.
 *
 *   necklines, sleeve_styles,  — line diagrams, drawn in
 *   dupatta_options              builder-diagrams.mjs and rasterised
 *                                here. A sweetheart and a V-neck differ
 *                                by one curve and stock does not label
 *                                that difference reliably; a drawing is
 *                                correct by construction, so there is no
 *                                matching step left to get wrong.
 *
 * `colours` is deliberately absent: those rows carry `hex_value` and the
 * tile already renders a flat swatch, which beats a photograph of a
 * colour.
 *
 * Object names carry a content hash, for the reason learned the hard way
 * on the branding images: a fixed name plus `?v=` does not reliably beat
 * every cache, and a changed picture that keeps showing the old one is
 * very hard to see as a caching problem.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { DIAGRAMS } from "./lib/builder-diagrams.mjs";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BUCKET = "media";
const PREFIX = "builder";
const PHOTO_DIR = ".builder";
const mode = process.argv.find((a) => a.startsWith("--")) ?? "--status";

/** Photographs, each viewed before it was assigned. */
const PHOTOS = {
  fabrics: {
    silk: {
      file: "silk-7232404.jpg",
      saw: "gold satin in soft folds with a bright lustrous highlight along each fold",
    },
    velvet: {
      file: "velvet-35974685.jpg",
      saw: "emerald velvet coiled on itself, the pile catching light differently on each face",
    },
    net: {
      file: "net-6843277.jpg",
      saw: "salmon tulle gathered into airy layers, the mesh visible where it doubles over",
    },
    organza: {
      file: "organza-4862896.jpg",
      saw: "pale blue sheer organza in crisp shallow ripples, holding its own shape",
    },
    georgette: {
      file: "georgette-6693873.jpg",
      saw: "pale blush georgette draped over stone, with the fine crinkle the weave is known for",
    },
  },
  embroidery_types: {
    zardozi: {
      file: "zardozi-8751904.jpg",
      saw: "gold metallic coil-work spirals repeated across a cream ground",
    },
    dabka: {
      file: "dabka-9850827.jpg",
      saw: "coiled gold wire looped into a border and a motif on deep orange silk — dabka is exactly this coiled wire",
    },
    "sequin-work": {
      file: "sequin-6276054.jpg",
      saw: "dense overlapping gold sequins covering the whole surface",
    },
    "thread-embroidery": {
      file: "thread-35623922.jpg",
      saw: "coloured silk thread florals worked on a hoop, in red, green and blue",
    },
    "mirror-work": {
      file: "mirror-17246956.jpg",
      saw: "coloured stones and gold discs set in gold surrounds across a magenta panel",
    },
  },
};

async function put(buffer, table, slug, contentType, ext) {
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 8);
  const path = `${PREFIX}/${table}/${slug}-${hash}.${ext}`;

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`${path}: ${error.message}`);

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

async function setImage(table, slug, url) {
  const { error } = await admin.from(table).update({ image_url: url }).eq("slug", slug);
  if (error) throw new Error(`${table}.${slug}: ${error.message}`);
}

async function seed() {
  let done = 0;

  console.log("Photographs");
  for (const [table, entries] of Object.entries(PHOTOS)) {
    for (const [slug, { file, saw }] of Object.entries(entries)) {
      const source = `${PHOTO_DIR}/${file}`;
      if (!existsSync(source)) {
        console.log(`  ! ${table}/${slug}: ${source} missing`);
        continue;
      }
      // Square, because the tile is aspect-square and object-cover would
      // otherwise crop a landscape file unpredictably. 600px is ample
      // for a tile that renders around 200px wide at 2x.
      const buffer = await sharp(await readFile(source))
        .resize(600, 600, { fit: "cover" })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
      const url = await put(buffer, table, slug, "image/jpeg", "jpg");
      await setImage(table, slug, url);
      console.log(`  + ${table}/${slug} (${(buffer.length / 1024).toFixed(0)} KB)`);
      console.log(`      ${saw}`);
      done += 1;
    }
  }

  console.log("\nDiagrams");
  for (const [table, svgs] of Object.entries(DIAGRAMS)) {
    for (const [slug, svg] of Object.entries(svgs)) {
      const buffer = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
      const url = await put(buffer, table, slug, "image/png", "png");
      await setImage(table, slug, url);
      console.log(`  + ${table}/${slug} (${(buffer.length / 1024).toFixed(0)} KB)`);
      done += 1;
    }
  }

  console.log(`\n${done} builder options given an image.`);
}

async function status() {
  for (const table of [
    "fabrics",
    "embroidery_types",
    "colours",
    "sleeve_styles",
    "necklines",
    "dupatta_options",
  ]) {
    // `hex_value` exists on `colours` only, so selecting it across all
    // six tables errored and returned null — which then threw on
    // `data.length` and made --status useless. Select what every table
    // has, and treat colours as a special case.
    const { data, error } = await admin
      .from(table)
      .select("slug, name, image_url")
      .eq("is_active", true)
      .order("sort_order");
    if (error) {
      console.log(`${table.padEnd(18)} ERROR ${error.message}`);
      continue;
    }
    if (table === "colours") {
      console.log(`${table.padEnd(18)} ${data.length} active, shown as hex swatches (no image needed)`);
      continue;
    }
    const missing = data.filter((r) => !r.image_url);
    console.log(
      `${table.padEnd(18)} ${data.length} active, ${missing.length} without a picture` +
        (missing.length ? ` — ${missing.map((m) => m.slug).join(", ")}` : "")
    );
  }
}

if (mode === "--seed") await seed();
else await status();

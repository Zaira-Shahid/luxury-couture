/**
 * Replaces a named product's generated gradient with a real photograph.
 *
 *   node --env-file=.env.local scripts/fix-product-photos.mjs --seed
 *
 * These three were the last placeholders in the catalogue and are handled
 * here rather than in a collection file because they belong to the
 * ORIGINAL demo twelve — they already exist, with their own slugs and
 * prices, so this swaps the image and corrects the copy to match what is
 * actually in the frame. It does not create products.
 *
 * Each entry was opened and looked at first; `saw:` records what is
 * really there, and the description is rewritten from that rather than
 * left describing a garment the photograph does not show.
 */
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
const PREFIX = "demo-store/photos";

const FIXES = [
  {
    slug: "meher-blush-anarkali",
    file: ".fixes/m-33216046.jpg",
    saw: "blush pink flared anarkali in georgette, mirror-work placket down the front, wide bell sleeves with a sequinned trim, seated outdoors",
    alt: "Blush pink georgette anarkali with a mirror-work placket and bell sleeves",
    description:
      "Blush georgette, cut as a full anarkali so the flare falls from just under the bust. A narrow mirror-work placket runs the length of the front — the only hard surface work on an otherwise soft piece.\n\nThe sleeves are wide and bell-cut, finished with a sequinned trim at the hem. Light enough to sit down in for a whole evening, which is the point of the cut.",
  },
  {
    slug: "priya-plum-evening-saree",
    file: ".fixes/p-28135787.jpg",
    saw: "plum-violet chiffon saree draped over the shoulder, worn with a contrast tie-dye blouse in orange and purple, seated against carved dark wood",
    alt: "Plum chiffon saree worn with a contrast tie-dye blouse",
    description:
      "Plum chiffon, unlined and unstiffened, so it drapes rather than holds a shape. Supplied with the contrast tie-dyed blouse shown — orange bleeding into purple, dyed in the piece rather than printed, so no two are identical.\n\nAn evening saree rather than a bridal one: no zari, no border weight, nothing that needs managing while you move.",
  },
];

async function run() {
  for (const fix of FIXES) {
    if (!existsSync(fix.file)) {
      console.log(`  ! ${fix.slug}: ${fix.file} missing — skipped`);
      continue;
    }
    const { data: product } = await admin
      .from("products")
      .select("id, name")
      .eq("slug", fix.slug)
      .maybeSingle();
    if (!product) {
      console.log(`  ! ${fix.slug}: no such product`);
      continue;
    }

    const buffer = await sharp(await readFile(fix.file))
      .resize({ width: 1400, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    // .jpg, so the placeholder-audit (which looks for stray .png) sees
    // this as a real photograph.
    const path = `${PREFIX}/${fix.slug}.jpg`;
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
    if (error) {
      console.log(`  ! ${fix.slug}: upload failed — ${error.message}`);
      continue;
    }
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

    const mediaRow = {
      storage_path: path,
      url: pub.publicUrl,
      file_type: "image/jpeg",
      size_bytes: buffer.length,
      alt_text: fix.alt,
    };
    const { data: existingMedia } = await admin
      .from("media")
      .select("id")
      .eq("storage_path", path)
      .maybeSingle();
    if (existingMedia) await admin.from("media").update(mediaRow).eq("id", existingMedia.id);
    else await admin.from("media").insert(mediaRow);

    // Replace every image row for this product, so the old gradient
    // cannot linger as a second image behind the new one.
    await admin.from("product_images").delete().eq("product_id", product.id);
    await admin.from("product_images").insert({
      product_id: product.id,
      url: pub.publicUrl,
      alt_text: fix.alt,
      is_primary: true,
      sort_order: 0,
    });

    await admin.from("products").update({ description: fix.description }).eq("id", product.id);

    console.log(`  + ${product.name}  (${(buffer.length / 1024).toFixed(0)} KB)`);
    console.log(`      ${fix.saw}`);
  }
}

await run();

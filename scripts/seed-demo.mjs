// Module 31 — the demo store.
//
//   node --env-file=.env.local scripts/seed-demo.mjs --seed
//   node --env-file=.env.local scripts/seed-demo.mjs --status
//   node --env-file=.env.local scripts/seed-demo.mjs --clear
//
// A SCRIPT, NOT A MIGRATION. Every other seed in this project is a
// migration, which is right for REFERENCE data — a fabric list is part of
// what the schema means. Demo products are different: you must be able to
// remove them before launch, and a migration that inserts demo products
// is either permanent or needs a second migration to undo it.
//
// EVERYTHING IT CREATES IS RECORDED in demo_seed_items (0060), so --clear
// deletes precisely those rows and can never touch real business data: a
// real product has no manifest entry and is therefore not a candidate at
// all. That property is what makes a destructive mode safe enough to
// ship, and scripts/test-seed-demo.mjs asserts it directly by seeding a
// hand-made product alongside and checking it survives.
//
// --seed is IDEMPOTENT: re-running updates the existing rows rather than
// creating a second set.
import { createClient } from "@supabase/supabase-js";

import {
  DEMO_BLOG_POSTS,
  DEMO_COLLECTIONS,
  DEMO_GALLERY_CAPTIONS,
  DEMO_PAGES,
  DEMO_PRODUCTS,
  DEMO_REVIEWS,
} from "./lib/demo-content.mjs";
import { generatePlaceholderPng } from "./lib/placeholder-image.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const mode = process.argv.find((a) => a.startsWith("--")) ?? "--status";

/**
 * Categories are now the two `0061` created. demo-content.mjs names them
 * directly, so this map is an identity pass kept only so an unknown slug
 * fails loudly here rather than silently writing a null category_id.
 */
const CATEGORY_MAP = {
  "asian-wear": "asian-wear",
  "western-wear": "western-wear",
};

const DEMO_EMAIL_DOMAIN = "demo-store.example";
const STORAGE_BUCKET = "media";
const STORAGE_PREFIX = "demo-store";

// ---------------------------------------------------------------------
// Manifest helpers

async function record(entityTable, entityId, detail) {
  await admin
    .from("demo_seed_items")
    .upsert({ entity_table: entityTable, entity_id: entityId, detail }, { onConflict: "entity_table,entity_id" });
}

async function manifestIds(entityTable) {
  const { data } = await admin
    .from("demo_seed_items")
    .select("entity_id, detail")
    .eq("entity_table", entityTable);
  return data ?? [];
}

// ---------------------------------------------------------------------
// Images

async function uploadPlaceholder(seed, width, height) {
  const png = generatePlaceholderPng(seed, width, height);
  const path = `${STORAGE_PREFIX}/${seed}.png`;

  const { error } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, png, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);

  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

// ---------------------------------------------------------------------

async function seed() {
  console.log("Seeding the demo store...\n");

  // --- categories ----------------------------------------------------
  const { data: existingCategories } = await admin.from("categories").select("id, slug");
  const categoryBySlug = new Map((existingCategories ?? []).map((c) => [c.slug, c.id]));

  // Categories are created by migration 0061, not here. They are
  // structural rather than demo content: retiring the demo store must
  // not remove the shop's own category tree.
  for (const slug of Object.values(CATEGORY_MAP)) {
    if (!categoryBySlug.has(slug)) {
      throw new Error(`category ${slug} is missing — run scripts/migrate.mjs first`);
    }
  }

  // --- products ------------------------------------------------------
  const productBySlug = new Map();
  for (const product of DEMO_PRODUCTS) {
    const categoryId = categoryBySlug.get(CATEGORY_MAP[product.categorySlug]);
    const { data: row, error } = await admin
      .from("products")
      .upsert(
        {
          name: product.name,
          slug: product.slug,
          category_id: categoryId ?? null,
          description: product.description,
          base_price: product.price,
          currency: "GBP",
          // Honours a per-product `status`, defaulting to published.
          // Without this the field was ignored and every re-seed
          // re-published Isla — the one demo product deliberately held
          // back for want of a usable photograph.
          status: product.status ?? "published",
          is_featured: !!product.featured,
          published_at:
            (product.status ?? "published") === "published"
              ? new Date().toISOString()
              : null,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();
    if (error) throw new Error(`product ${product.slug}: ${error.message}`);

    productBySlug.set(product.slug, row.id);
    await record("products", row.id, product.slug);

    // Occasion tags. Replaced wholesale rather than merged, so removing
    // a tag from demo-content.mjs actually removes it on the next seed.
    if (product.occasions?.length) {
      await admin.from("product_occasions").delete().eq("product_id", row.id);
      const { data: occasionRows } = await admin
        .from("occasions")
        .select("id, slug")
        .in("slug", product.occasions);

      const missing = product.occasions.filter(
        (slug) => !(occasionRows ?? []).some((o) => o.slug === slug)
      );
      if (missing.length) {
        throw new Error(`unknown occasion(s) for ${product.slug}: ${missing.join(", ")}`);
      }

      await admin
        .from("product_occasions")
        .insert((occasionRows ?? []).map((o) => ({ product_id: row.id, occasion_id: o.id })));
    }

    // Primary image. Portrait, because that is how garments are shot.
    const { url: imageUrl, path } = await uploadPlaceholder(product.slug, 1200, 1500);
    const { data: existingImage } = await admin
      .from("product_images")
      .select("id")
      .eq("product_id", row.id)
      .eq("is_primary", true)
      .maybeSingle();

    if (existingImage) {
      // Do NOT clobber a real photograph with a gradient.
      //
      // seed-demo-photos.mjs replaces these URLs with Pexels imagery
      // re-hosted on Supabase. Re-running --seed used to overwrite that
      // and silently put the placeholders back — and because
      // test-seed-demo.mjs clears and re-seeds as part of its own run,
      // the whole suite would have quietly reverted the catalogue's
      // photography every time it ran.
      const { data: current } = await admin
        .from("product_images")
        .select("url")
        .eq("id", existingImage.id)
        .maybeSingle();

      if (!current?.url?.includes("demo-store/photos/")) {
        await admin.from("product_images").update({ url: imageUrl }).eq("id", existingImage.id);
      }
    } else {
      const { data: image } = await admin
        .from("product_images")
        .insert({
          product_id: row.id,
          url: imageUrl,
          alt_text: `${product.name} — placeholder image`,
          is_primary: true,
          sort_order: 0,
        })
        .select("id")
        .single();
      if (image) await record("product_images", image.id, path);
    }
  }
  console.log(`  + ${DEMO_PRODUCTS.length} products (with generated images)`);

  // --- collections ---------------------------------------------------
  for (const collection of DEMO_COLLECTIONS) {
    // THE SAME GUARD THE PRODUCT IMAGES ABOVE ALREADY HAD, which
    // collections were missing. seed-homepage-media.mjs points each cover
    // at a real photograph of a piece inside that collection; without
    // this check, any later `--seed` overwrote all four with generated
    // gradients again, so the homepage silently reverted. The bug only
    // showed up on a RE-run, which is why it survived the first pass.
    const { data: existingCover } = await admin
      .from("collections")
      .select("cover_image_url")
      .eq("slug", collection.slug)
      .maybeSingle();
    const keepCover = existingCover?.cover_image_url?.includes("demo-store/photos/");

    const coverUrl = keepCover
      ? existingCover.cover_image_url
      : (await uploadPlaceholder(`collection-${collection.slug}`, 1600, 900)).url;

    const { data: row, error } = await admin
      .from("collections")
      .upsert(
        {
          name: collection.name,
          slug: collection.slug,
          description: collection.description,
          cover_image_url: coverUrl,
          is_featured: !!collection.featured,
          is_active: true,
          published_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();
    if (error) throw new Error(`collection ${collection.slug}: ${error.message}`);
    await record("collections", row.id, collection.slug);

    for (const slug of collection.productSlugs) {
      const productId = productBySlug.get(slug);
      if (!productId) continue;
      await admin
        .from("product_collections")
        .upsert({ product_id: productId, collection_id: row.id }, { onConflict: "product_id,collection_id" });
    }
  }
  console.log(`  + ${DEMO_COLLECTIONS.length} collections`);

  // --- demo customers + reviews --------------------------------------
  //
  // reviews.customer_id is NOT NULL, so testimonials need accounts. They
  // use a reserved-TLD domain (RFC 2606) that can never reach a real
  // inbox, and they are recorded in the manifest so --clear removes them.
  let reviewCount = 0;
  for (const review of DEMO_REVIEWS) {
    const handle = review.customer.toLowerCase().replace(/[^a-z]/g, "");
    const email = `${handle}@${DEMO_EMAIL_DOMAIN}`;

    let customerId;
    const { data: existingUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = existingUsers?.users.find((u) => u.email === email);
    if (found) {
      customerId = found.id;
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password: `demo-${handle}-${Date.now()}`,
        email_confirm: true,
        user_metadata: { full_name: review.customer },
      });
      if (error) throw new Error(`demo customer ${email}: ${error.message}`);
      customerId = created.user.id;
      await record("auth_users", customerId, email);
      await new Promise((r) => setTimeout(r, 150));
      await admin.from("profiles").update({ full_name: review.customer }).eq("id", customerId);
    }

    const productId = productBySlug.get(review.productSlug);
    const { data: existingReview } = await admin
      .from("reviews")
      .select("id")
      .eq("customer_id", customerId)
      .eq("product_id", productId ?? null)
      .maybeSingle();

    if (existingReview) {
      await admin
        .from("reviews")
        .update({ rating: review.rating, title: review.title, body: review.body, is_published: true })
        .eq("id", existingReview.id);
    } else {
      const { data: row, error } = await admin
        .from("reviews")
        .insert({
          customer_id: customerId,
          product_id: productId ?? null,
          rating: review.rating,
          title: review.title,
          body: review.body,
          is_published: true,
          is_featured: review.rating === 5,
        })
        .select("id")
        .single();
      if (error) throw new Error(`review ${review.customer}: ${error.message}`);
      await record("reviews", row.id, review.customer);
    }
    reviewCount += 1;
  }
  console.log(`  + ${reviewCount} testimonials (with demo customer accounts)`);

  // --- blog ----------------------------------------------------------
  for (const post of DEMO_BLOG_POSTS) {
    const { url: coverUrl } = await uploadPlaceholder(`blog-${post.slug}`, 1600, 900);
    const { data: row, error } = await admin
      .from("blog_posts")
      .upsert(
        {
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          cover_image_url: coverUrl,
          status: "published",
          published_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();
    if (error) throw new Error(`blog ${post.slug}: ${error.message}`);
    await record("blog_posts", row.id, post.slug);
  }
  console.log(`  + ${DEMO_BLOG_POSTS.length} blog posts`);

  // --- pages ---------------------------------------------------------
  for (const page of DEMO_PAGES) {
    const { data: row, error } = await admin
      .from("pages")
      .upsert(
        { title: page.title, slug: page.slug, content: page.content, status: "published" },
        { onConflict: "slug" }
      )
      .select("id")
      .single();
    if (error) throw new Error(`page ${page.slug}: ${error.message}`);
    await record("pages", row.id, page.slug);
  }
  console.log(`  + ${DEMO_PAGES.length} pages (including /privacy)`);

  // --- social gallery ------------------------------------------------
  const { data: existingGallery } = await admin.from("social_gallery_images").select("id");
  if ((existingGallery?.length ?? 0) === 0) {
    for (const [index, caption] of DEMO_GALLERY_CAPTIONS.entries()) {
      const { url: imageUrl, path } = await uploadPlaceholder(`gallery-${index}`, 1000, 1000);
      const { data: row } = await admin
        .from("social_gallery_images")
        .insert({ image_url: imageUrl, caption, sort_order: index, is_active: true })
        .select("id")
        .single();
      if (row) await record("social_gallery_images", row.id, path);
    }
    console.log(`  + ${DEMO_GALLERY_CAPTIONS.length} gallery images`);
  }

  console.log("\nDone. Run with --status to see the footprint, --clear to remove it.");
}

// ---------------------------------------------------------------------

async function status() {
  const { data } = await admin.from("demo_seed_items").select("entity_table");
  const counts = {};
  for (const row of data ?? []) counts[row.entity_table] = (counts[row.entity_table] ?? 0) + 1;

  if (Object.keys(counts).length === 0) {
    console.log("No demo data is currently seeded.");
    return;
  }

  console.log("Demo store footprint (from the manifest):\n");
  for (const [table, count] of Object.entries(counts).sort()) {
    console.log(`  ${String(count).padStart(4)}  ${table}`);
  }
  console.log(`\n  ${String(data.length).padStart(4)}  total tracked rows`);
  console.log("\nRemove it all with --clear.");
}

// ---------------------------------------------------------------------

async function clear() {
  console.log("Removing the demo store...\n");

  // Dependency order. product_images and product_collections cascade
  // from products, and reviews cascade from profiles, but they are
  // deleted explicitly first so the manifest is drained even where a
  // cascade already removed the row.
  const ORDER = [
    "reviews",
    "product_images",
    // Media Library rows for the sourced photographs. Added after the
    // photo seeder started recording them: --clear was deleting the
    // storage objects but leaving the media rows behind, so the manifest
    // never drained and the Media Library kept showing entries whose
    // files no longer existed.
    "media",
    "social_gallery_images",
    "blog_posts",
    "pages",
    "collections",
    "products",
    "categories",
  ];

  for (const table of ORDER) {
    const items = await manifestIds(table);
    if (items.length === 0) continue;
    const ids = items.map((i) => i.entity_id);
    const { error } = await admin.from(table).delete().in("id", ids);
    if (error) {
      console.log(`  ! ${table}: ${error.message}`);
      continue;
    }
    await admin.from("demo_seed_items").delete().eq("entity_table", table).in("entity_id", ids);
    console.log(`  - ${ids.length} ${table}`);
  }

  // Demo customer accounts.
  const users = await manifestIds("auth_users");
  for (const user of users) {
    await admin.auth.admin.deleteUser(user.entity_id);
  }
  if (users.length > 0) {
    await admin.from("demo_seed_items").delete().eq("entity_table", "auth_users");
    console.log(`  - ${users.length} demo customer accounts`);
  }

  // Generated images. Listed from storage under the demo prefix rather
  // than from the manifest, so an image whose manifest row was already
  // removed by a cascade is still cleaned up.
  // Recurses. Supabase's list() returns only DIRECT children, and a
  // subfolder comes back as an entry with no id — so the first version of
  // this tried to remove "demo-store/photos" as if it were a file and
  // silently left the twelve photographs inside it orphaned in storage.
  async function removeUnder(prefix) {
    const { data: entries } = await admin.storage
      .from(STORAGE_BUCKET)
      .list(prefix, { limit: 1000 });
    if (!entries?.length) return 0;

    const files = entries.filter((e) => e.id);
    const folders = entries.filter((e) => !e.id);

    let removed = 0;
    for (const folder of folders) removed += await removeUnder(`${prefix}/${folder.name}`);

    if (files.length > 0) {
      const paths = files.map((f) => `${prefix}/${f.name}`);
      const { error } = await admin.storage.from(STORAGE_BUCKET).remove(paths);
      if (error) console.log(`  ! storage ${prefix}: ${error.message}`);
      else removed += paths.length;
    }
    return removed;
  }

  const removedFiles = await removeUnder(STORAGE_PREFIX);
  if (removedFiles > 0) console.log(`  - ${removedFiles} images from storage`);

  const { count: remaining } = await admin
    .from("demo_seed_items")
    .select("id", { count: "exact", head: true });
  console.log(`\nDone. ${remaining ?? 0} manifest rows remain.`);
}

// ---------------------------------------------------------------------

if (mode === "--seed") await seed();
else if (mode === "--clear") await clear();
else await status();

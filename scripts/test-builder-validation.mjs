// The builder's SERVER-ACTION path: the Zod schema, and the RPCs behind
// it, driven exactly as BuilderShell drives them.
//
//   node --env-file=.env.local scripts/test-builder-validation.mjs
//
// WHY THIS EXISTS SEPARATELY FROM test-builder-rpcs.mjs.
//
// That script calls create_builder_configuration and
// update_builder_configuration directly and has always passed. The
// builder was still broken for months, because every real request goes
// through builderSelectionsSchema FIRST and that schema rejected `null`
// — which is what BuilderShell sends for every option the customer has
// not chosen yet. The RPCs were never reached, so testing them proved
// nothing about the feature working.
//
// The lesson this file encodes: test the boundary the UI actually calls,
// not the layer underneath it.
import { createClient } from "@supabase/supabase-js";

import { builderSelectionsSchema } from "../src/lib/validations/builder.ts";

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let passed = 0;
let failed = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
  ok ? (passed += 1) : (failed += 1);
}

// ---------------------------------------------------------------------
console.log("\n# The schema accepts what BuilderShell actually sends");

// BuilderShell's `Selections` initialises every unchosen field to null.
const emptySelections = {
  productId: null,
  fabricId: null,
  embroideryTypeId: null,
  colourId: null,
  sleeveStyleId: null,
  necklineId: null,
  dupattaOptionId: null,
  customNotes: null,
};

const allNull = builderSelectionsSchema.safeParse(emptySelections);
check(
  "a completely empty design validates",
  allNull.success,
  allNull.success ? "" : allNull.error.issues.map((i) => i.path.join(".")).join(", ")
);

// ---------------------------------------------------------------------
console.log("\n# Every step, one at a time — the exact regression");

const tables = {
  fabricId: "fabrics",
  embroideryTypeId: "embroidery_types",
  colourId: "colours",
  sleeveStyleId: "sleeve_styles",
  necklineId: "necklines",
  dupattaOptionId: "dupatta_options",
};

const chosen = { ...emptySelections };
const { data: product } = await anon
  .from("products")
  .select("id, name, base_price")
  .eq("status", "published")
  .limit(1)
  .single();
chosen.productId = product.id;

const styleOnly = builderSelectionsSchema.safeParse(chosen);
check(
  "a Style chosen and nothing else validates",
  styleOnly.success,
  "this is the payload the first Next click sends"
);

for (const [key, table] of Object.entries(tables)) {
  const { data: option } = await anon
    .from(table)
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order")
    .limit(1)
    .single();
  chosen[key] = option.id;

  // Each Next sends the WHOLE object, so the remaining fields are still
  // null. That mixture is what used to fail.
  const parsed = builderSelectionsSchema.safeParse(chosen);
  check(`${table}: chosen, later steps still null`, parsed.success, option.name);
}

// ---------------------------------------------------------------------
console.log("\n# The price the panel shows");

const priceArgs = {
  p_product_id: chosen.productId,
  p_fabric_id: chosen.fabricId,
  p_embroidery_type_id: chosen.embroideryTypeId,
  p_colour_id: chosen.colourId,
  p_sleeve_style_id: chosen.sleeveStyleId,
  p_neckline_id: chosen.necklineId,
  p_dupatta_option_id: chosen.dupattaOptionId,
};
const { data: fullPrice, error: priceErr } = await anon.rpc(
  "compute_builder_estimated_price",
  priceArgs
);
check("the price RPC runs for anonymous visitors", !priceErr, priceErr?.message);
check(
  "a fully chosen design costs at least the base product",
  Number(fullPrice) >= Number(product.base_price),
  `£${fullPrice} vs base £${product.base_price}`
);

// The symptom the owner reported was £0.00. Assert it directly.
check("the estimate is NOT zero", Number(fullPrice) > 0, `£${fullPrice}`);

// ---------------------------------------------------------------------
console.log("\n# End to end: create, then update, as a guest");

const parsedForRpc = builderSelectionsSchema.parse({ ...chosen, productId: product.id });
const { data: created, error: createErr } = await anon.rpc("create_builder_configuration", {
  p_product_id: parsedForRpc.productId,
  p_fabric_id: parsedForRpc.fabricId,
  p_embroidery_type_id: parsedForRpc.embroideryTypeId,
  p_colour_id: parsedForRpc.colourId,
  p_sleeve_style_id: parsedForRpc.sleeveStyleId,
  p_neckline_id: parsedForRpc.necklineId,
  p_dupatta_option_id: parsedForRpc.dupattaOptionId,
  p_custom_notes: parsedForRpc.customNotes,
});
check("a guest can create a configuration", !createErr && !!created, createErr?.message);

if (created) {
  check(
    "it is stored with a non-zero estimated price",
    Number(created.estimated_price) > 0,
    `£${created.estimated_price}`
  );

  // Changing one option must move the stored price — this is what the
  // panel re-reads after every Next.
  //
  // Explicitly a DIFFERENT row with a DIFFERENT adjustment, not just the
  // dearest: the first version of this took the dearest, which was
  // already the selected one, so the price legitimately did not move and
  // the test failed for its own reasons rather than the code's.
  const { data: allEmbroidery } = await anon
    .from("embroidery_types")
    .select("id, name, price_adjustment")
    .eq("is_active", true);
  const currentAdj = Number(
    allEmbroidery.find((e) => e.id === parsedForRpc.embroideryTypeId)?.price_adjustment ?? 0
  );
  const dearer = allEmbroidery.find(
    (e) => e.id !== parsedForRpc.embroideryTypeId && Number(e.price_adjustment) !== currentAdj
  );
  if (!dearer) {
    check(
      "a second embroidery option with a different price exists",
      false,
      "cannot test a price change without one"
    );
  }

  const { data: updated, error: updErr } = await anon.rpc("update_builder_configuration", {
    p_id: created.id,
    p_token: created.share_token,
    p_product_id: parsedForRpc.productId,
    p_fabric_id: parsedForRpc.fabricId,
    p_embroidery_type_id: dearer.id,
    p_colour_id: parsedForRpc.colourId,
    p_sleeve_style_id: parsedForRpc.sleeveStyleId,
    p_neckline_id: parsedForRpc.necklineId,
    p_dupatta_option_id: parsedForRpc.dupattaOptionId,
    p_custom_notes: null,
  });
  check("a guest can update it with their token", !updErr && !!updated, updErr?.message);
  if (updated && dearer) {
    check(
      `swapping embroidery to ${dearer.name} changes the price`,
      Number(updated.estimated_price) !== Number(created.estimated_price),
      `£${created.estimated_price} -> £${updated.estimated_price}`
    );
  }

  console.log("\nCleaning up...");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  await admin.from("builder_configurations").delete().eq("id", created.id);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

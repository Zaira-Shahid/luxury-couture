import type { Metadata } from "next";

import { BuilderShell } from "@/components/builder/builder-shell";
import { getAuthUser } from "@/lib/auth/session";
import { getBuilderOptionSets } from "@/lib/builder/get-options";
import { getOptionOccasionLabels } from "@/lib/catalog/get-occasions";
import { getPublishedProducts, getProductBySlug } from "@/lib/catalog/get-products";
import { buildMetadata } from "@/lib/seo/build-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Custom Builder",
    description:
      "Design your own lehenga — choose fabric, colour, embroidery, sleeves, neckline and dupatta.",
    path: "/builder",
  });
}

/**
 * Module 23 builder guidance. Loaded server-side so the option tiles can
 * show which occasions each fabric/colour/embroidery suits — curated by
 * the admin in `builder_option_occasions`, never generated text.
 */
async function loadOccasionLabels() {
  const [fabrics, colours, embroidery_types] = await Promise.all([
    getOptionOccasionLabels("fabrics"),
    getOptionOccasionLabels("colours"),
    getOptionOccasionLabels("embroidery_types"),
  ]);
  return { fabrics, colours, embroidery_types };
}

export default async function BuilderStartPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: productSlug } = await searchParams;

  const [options, products, user, preselected, occasionLabels] = await Promise.all([
    getBuilderOptionSets(),
    getPublishedProducts(),
    getAuthUser(),
    productSlug ? getProductBySlug(productSlug) : Promise.resolve(null),
    loadOccasionLabels(),
  ]);

  return (
    <BuilderShell
      occasionLabels={occasionLabels}
      initialConfig={null}
      initialImages={[]}
      options={options}
      products={products}
      isSignedIn={!!user}
      initialProductId={preselected?.id ?? null}
    />
  );
}

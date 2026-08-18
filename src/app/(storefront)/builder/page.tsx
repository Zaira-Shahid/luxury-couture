import type { Metadata } from "next";

import { BuilderShell } from "@/components/builder/builder-shell";
import { getAuthUser } from "@/lib/auth/session";
import { getBuilderOptionSets } from "@/lib/builder/get-options";
import { getPublishedProducts, getProductBySlug } from "@/lib/catalog/get-products";

export const metadata: Metadata = { title: "Custom Builder" };

export default async function BuilderStartPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: productSlug } = await searchParams;

  const [options, products, user, preselected] = await Promise.all([
    getBuilderOptionSets(),
    getPublishedProducts(),
    getAuthUser(),
    productSlug ? getProductBySlug(productSlug) : Promise.resolve(null),
  ]);

  return (
    <BuilderShell
      initialConfig={null}
      initialImages={[]}
      options={options}
      products={products}
      isSignedIn={!!user}
      initialProductId={preselected?.id ?? null}
    />
  );
}

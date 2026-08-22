import type { Metadata } from "next";
import Link from "next/link";

import { BuilderShell } from "@/components/builder/builder-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthUser } from "@/lib/auth/session";
import { getBuilderConfiguration, getInspirationImages } from "@/lib/builder/get-configuration";
import { getBuilderOptionSets } from "@/lib/builder/get-options";
import { getOptionOccasionLabels } from "@/lib/catalog/get-occasions";
import { getPublishedProducts } from "@/lib/catalog/get-products";

export const metadata: Metadata = { title: "Custom Builder" };

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

export default async function BuilderContinuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token) {
    return <InvalidLink />;
  }

  const config = await getBuilderConfiguration(id, token);
  if (!config) {
    return <InvalidLink />;
  }

  const [options, products, images, user, occasionLabels] = await Promise.all([
    getBuilderOptionSets(),
    getPublishedProducts(),
    getInspirationImages(id, token),
    getAuthUser(),
    loadOccasionLabels(),
  ]);

  return (
    <BuilderShell
      occasionLabels={occasionLabels}
      initialConfig={config}
      initialImages={images}
      options={options}
      products={products}
      isSignedIn={!!user}
    />
  );
}

function InvalidLink() {
  return (
    <div className="container flex min-h-[50vh] items-center justify-center py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Link Not Found</CardTitle>
          <CardDescription>
            This design link is invalid or incomplete. Start a new design instead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/builder" className="text-sm text-primary underline-offset-4 hover:underline">
            Start the Custom Builder
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

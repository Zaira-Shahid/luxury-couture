import type { Metadata } from "next";
import Link from "next/link";

import { BuilderShell } from "@/components/builder/builder-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthUser } from "@/lib/auth/session";
import { getBuilderConfiguration, getInspirationImages } from "@/lib/builder/get-configuration";
import { getBuilderOptionSets } from "@/lib/builder/get-options";
import { getPublishedProducts } from "@/lib/catalog/get-products";

export const metadata: Metadata = { title: "Custom Builder" };

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

  const [options, products, images, user] = await Promise.all([
    getBuilderOptionSets(),
    getPublishedProducts(),
    getInspirationImages(id, token),
    getAuthUser(),
  ]);

  return (
    <BuilderShell
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

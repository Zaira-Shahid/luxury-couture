import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RichText } from "@/components/content/rich-text";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { getPageBySlug } from "@/lib/content/get-content";
import { buildMetadata } from "@/lib/seo/build-metadata";
import { getSeoMetadata } from "@/lib/seo/get-seo-metadata";

/**
 * Root-level CMS pages: /about, /faq-style static content, /terms, and so
 * on, driven by the `pages` table.
 *
 * This is the lowest-priority route in the storefront group. Next.js
 * always matches static segments before a dynamic one, so /products,
 * /cart, /blog, /login and every other real route win outright — a CMS
 * slug can never shadow them, and an unrecognised slug 404s here.
 *
 * Root-level URLs were an explicit owner decision (over a /pages/ prefix)
 * because /about reads better and ranks better than /pages/about.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) return { title: "Not Found" };

  const overrides = await getSeoMetadata("page", page.id);
  return buildMetadata({
    title: page.title,
    // `pages` has no dedicated excerpt column, so fall back to the
    // opening of the body rather than shipping no description at all.
    description: page.content?.trim().slice(0, 200) || null,
    path: `/${page.slug}`,
    overrides,
  });
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();

  return (
    <div className="container max-w-3xl py-16">
      <Breadcrumbs
        className="mb-8"
        items={[
          { name: "Home", path: "/" },
          { name: page.title, path: `/${page.slug}` },
        ]}
      />
      <h1 className="font-heading text-4xl">{page.title}</h1>
      <div className="mt-6">
        <RichText content={page.content} />
      </div>
    </div>
  );
}

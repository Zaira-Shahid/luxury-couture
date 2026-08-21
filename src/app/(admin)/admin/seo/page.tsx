import type { Metadata } from "next";
import Link from "next/link";

import { getActiveCollections } from "@/lib/catalog/get-collections";
import { getPublishedProducts } from "@/lib/catalog/get-products";
import { getAdminBlogPosts, getAdminPages } from "@/lib/admin/get-content";
import { saveSeoOverride, updateSeoDefaults } from "@/features/admin-seo/actions";
import { getSeoMetadataByType } from "@/lib/seo/get-seo-metadata";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

import { SeoDefaultsForm, SeoOverrideForm, type OverrideTarget } from "./seo-forms";

export const metadata: Metadata = { title: "SEO" };

export default async function AdminSeoPage() {
  // Only publicly-visible entities are offered for overrides — an
  // override on a draft would be dead configuration.
  const [settings, products, collections, posts, pages] = await Promise.all([
    getSiteSettings(),
    getPublishedProducts(),
    getActiveCollections(),
    getAdminBlogPosts(),
    getAdminPages(),
  ]);

  const [productSeo, collectionSeo, postSeo, pageSeo] = await Promise.all([
    getSeoMetadataByType("product"),
    getSeoMetadataByType("collection"),
    getSeoMetadataByType("blog_post"),
    getSeoMetadataByType("page"),
  ]);

  const groups: { heading: string; description: string; targets: OverrideTarget[] }[] = [
    {
      heading: "Products",
      description: "Overrides the product name and description in search results and shares.",
      targets: products.map((p) => ({
        entityType: "product" as const,
        entityId: p.id,
        label: p.name,
        path: `/products/${p.slug}`,
        existing: productSeo.get(p.id) ?? null,
      })),
    },
    {
      heading: "Collections",
      description: "Overrides the collection name and description.",
      targets: collections.map((c) => ({
        entityType: "collection" as const,
        entityId: c.id,
        label: c.name,
        path: `/collections/${c.slug}`,
        existing: collectionSeo.get(c.id) ?? null,
      })),
    },
    {
      heading: "Site Pages",
      description: "Overrides the page title and its auto-generated description.",
      targets: pages
        .filter((p) => p.status === "published")
        .map((p) => ({
          entityType: "page" as const,
          entityId: p.id,
          label: p.title,
          path: `/${p.slug}`,
          existing: pageSeo.get(p.id) ?? null,
        })),
    },
    {
      heading: "Journal Posts",
      description: "Overrides the post title and excerpt.",
      targets: posts
        .filter((p) => p.status === "published")
        .map((p) => ({
          entityType: "blog_post" as const,
          entityId: p.id,
          label: p.title,
          path: `/blog/${p.slug}`,
          existing: postSeo.get(p.id) ?? null,
        })),
    },
  ];

  return (
    <div className="container flex flex-col gap-12 py-10">
      <div>
        <h1 className="font-heading text-2xl">SEO</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Site-wide defaults, plus per-page overrides. Anything left blank falls back down the
          chain: override → the item&apos;s own field → these defaults.
        </p>
      </div>

      {!settings.seo.indexingEnabled ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-foreground">This site is currently hidden from search.</p>
          <p className="mt-1 text-muted-foreground">
            robots.txt blocks all crawlers and every page sends <code>noindex</code>. Enable
            indexing below when you are ready to launch.
          </p>
        </div>
      ) : null}

      <section className="max-w-2xl">
        <h2 className="mb-4 font-heading text-xl">Site Defaults</h2>
        <SeoDefaultsForm settings={settings} action={updateSeoDefaults} />
      </section>

      <section>
        <h2 className="font-heading text-xl">Per-Page Overrides</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Only published, publicly-visible items appear here.
        </p>

        <div className="mt-6 flex flex-col gap-10">
          {groups.map((group) => (
            <div key={group.heading}>
              <h3 className="font-medium">{group.heading}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
              {group.targets.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nothing published yet.{" "}
                  {group.heading === "Site Pages" || group.heading === "Journal Posts" ? (
                    <Link href="/admin/content" className="underline hover:text-foreground">
                      Add content
                    </Link>
                  ) : null}
                </p>
              ) : (
                <div className="mt-3">
                  {group.targets.map((target) => (
                    <SeoOverrideForm
                      // Remount when the stored override changes so the
                      // inputs pick up new defaultValues (see the Base UI
                      // note in docs/ARCHITECTURE.md).
                      key={`${target.entityId}-${target.existing?.updated_at ?? "none"}`}
                      target={target}
                      action={saveSeoOverride}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

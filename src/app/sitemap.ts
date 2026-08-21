import type { MetadataRoute } from "next";

import { getActiveCollections } from "@/lib/catalog/get-collections";
import { getPublishedProducts } from "@/lib/catalog/get-products";
import { getPublishedBlogPosts, getPublishedPages } from "@/lib/content/get-content";
import { absoluteUrl } from "@/lib/seo/urls";

/**
 * Public sitemap at /sitemap.xml, referenced from robots.txt.
 *
 * Only genuinely public, indexable, canonical URLs belong here. Anything
 * behind auth (/account, /admin), transient (/cart, /checkout) or
 * intentionally unindexed (/unsubscribe) is deliberately absent — those
 * are also Disallowed in robots.ts.
 *
 * Reads through the same cached catalog helpers the storefront uses, so
 * the sitemap can never list a product the storefront wouldn't render:
 * both are filtered by `status = 'published'` / `is_active` at the query
 * level and by RLS underneath.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/products"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/collections"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/builder"), changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/consultations"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/blog"), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/faq"), changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.5 },
  ];

  const [products, collections, posts, pages] = await Promise.all([
    getPublishedProducts(),
    getActiveCollections(),
    getPublishedBlogPosts(),
    getPublishedPages(),
  ]);

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: absoluteUrl(`/products/${product.slug}`),
    lastModified: new Date(product.updated_at),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const collectionEntries: MetadataRoute.Sitemap = collections.map((collection) => ({
    url: absoluteUrl(`/collections/${collection.slug}`),
    lastModified: new Date(collection.updated_at),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.updated_at),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // CMS pages live at the root (/about, /terms) — see (storefront)/[slug].
  const pageEntries: MetadataRoute.Sitemap = pages.map((page) => ({
    url: absoluteUrl(`/${page.slug}`),
    lastModified: new Date(page.updated_at),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [
    ...staticEntries,
    ...productEntries,
    ...collectionEntries,
    ...blogEntries,
    ...pageEntries,
  ];
}

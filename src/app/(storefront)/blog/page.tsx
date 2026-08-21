import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { getPublishedBlogPosts } from "@/lib/content/get-content";
import { buildMetadata } from "@/lib/seo/build-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Journal",
    description:
      "Notes on craftsmanship, fabric, colour and occasion from our atelier — plus guidance for planning your bespoke lehenga.",
    path: "/blog",
  });
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogIndexPage() {
  const posts = await getPublishedBlogPosts();

  return (
    <div className="container py-16">
      <Breadcrumbs
        className="mb-8"
        items={[
          { name: "Home", path: "/" },
          { name: "Journal", path: "/blog" },
        ]}
      />
      <h1 className="font-heading text-4xl">Journal</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Notes on craftsmanship, fabric and occasion from our atelier.
      </p>

      {posts.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No posts published yet — check back soon.</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article key={post.id}>
              <Link href={`/blog/${post.slug}`} className="group block">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                  {post.cover_image_url ? (
                    <Image
                      src={post.cover_image_url}
                      alt={post.title}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="size-full bg-gradient-to-br from-secondary to-muted" />
                  )}
                </div>
                <h2 className="mt-4 font-heading text-xl transition-colors group-hover:text-primary">
                  {post.title}
                </h2>
              </Link>
              {formatDate(post.published_at) ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(post.published_at)}
                </p>
              ) : null}
              {post.excerpt ? (
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

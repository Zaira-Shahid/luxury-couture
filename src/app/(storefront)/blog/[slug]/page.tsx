import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { RichText } from "@/components/content/rich-text";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/lib/config/site";
import { getBlogPostBySlug } from "@/lib/content/get-content";
import { buildMetadata } from "@/lib/seo/build-metadata";
import { getSeoMetadata } from "@/lib/seo/get-seo-metadata";
import { blogPostingSchema } from "@/lib/seo/structured-data";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return { title: "Journal" };

  const overrides = await getSeoMetadata("blog_post", post.id);
  return buildMetadata({
    title: post.title,
    description: post.excerpt,
    image: post.cover_image_url,
    path: `/blog/${post.slug}`,
    type: "article",
    publishedTime: post.published_at,
    modifiedTime: post.updated_at,
    overrides,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  const settings = await getSiteSettings();
  const publisherName = settings.seo.defaultTitle ?? siteConfig.name;

  return (
    <article className="container max-w-3xl py-16">
      <JsonLd
        data={blogPostingSchema({
          title: post.title,
          description: post.excerpt,
          path: `/blog/${post.slug}`,
          imageUrl: post.cover_image_url,
          publishedAt: post.published_at,
          updatedAt: post.updated_at,
          publisherName,
        })}
      />
      <Breadcrumbs
        className="mb-8"
        items={[
          { name: "Home", path: "/" },
          { name: "Journal", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ]}
      />

      <h1 className="font-heading text-4xl">{post.title}</h1>
      {post.published_at ? (
        <p className="mt-2 text-sm text-muted-foreground">
          <time dateTime={post.published_at}>
            {new Date(post.published_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        </p>
      ) : null}

      {post.cover_image_url ? (
        <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-xl bg-muted">
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            sizes="(min-width: 768px) 768px, 100vw"
            priority
            className="object-cover"
          />
        </div>
      ) : null}

      {post.excerpt ? <p className="mt-8 text-lg text-foreground">{post.excerpt}</p> : null}

      <div className="mt-6">
        <RichText content={post.content} />
      </div>
    </article>
  );
}

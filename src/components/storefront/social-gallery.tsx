import { ImageIcon } from "lucide-react";

import { StorefrontImage } from "@/components/shared/storefront-image";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { getInstagramProvider } from "@/lib/social";

export async function SocialGallery() {
  const posts = await getInstagramProvider().getRecentPosts(6);

  return (
    <section className="container py-20">
      <ScrollReveal>
        <h2 className="mb-2 text-center font-heading text-3xl sm:text-4xl">Follow Along</h2>
        <p className="mb-10 text-center text-sm text-muted-foreground">@luxurylehengacouture</p>
      </ScrollReveal>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {posts.length > 0
          ? posts.map((post, i) => (
              <ScrollReveal key={post.id} delay={i * 0.04}>
                {post.permalink ? (
                  <a href={post.permalink} target="_blank" rel="noreferrer" className="relative block aspect-square overflow-hidden rounded-lg">
                    <StorefrontImage
                      src={post.imageUrl}
                      alt={post.caption ?? "Social gallery image"}
                      sizes="(min-width: 640px) 16vw, 33vw"
                      className="object-cover"
                    />
                  </a>
                ) : (
                  <div className="relative aspect-square overflow-hidden rounded-lg">
                    <StorefrontImage
                      src={post.imageUrl}
                      alt={post.caption ?? "Social gallery image"}
                      sizes="(min-width: 640px) 16vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                )}
              </ScrollReveal>
            ))
          : Array.from({ length: 6 }).map((_, i) => (
              <ScrollReveal key={i} delay={i * 0.04}>
                <div className="flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br from-secondary to-muted">
                  <ImageIcon className="size-6 text-muted-foreground" strokeWidth={1.5} />
                </div>
              </ScrollReveal>
            ))}
      </div>
    </section>
  );
}

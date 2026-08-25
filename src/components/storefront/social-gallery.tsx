import { ImageIcon } from "lucide-react";

import { StorefrontImage } from "@/components/shared/storefront-image";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { getInstagramProvider } from "@/lib/social";

/**
 * Tiles come from `social_gallery_images` (0039) via the provider — an
 * admin-curated table, editable in the admin, and shaped like a real
 * Instagram post so a live integration can replace the provider later
 * without touching this component.
 *
 * The rows used to hold six generated gradients, which is what the
 * homepage was actually rendering. seed-homepage-media.mjs now puts the
 * shop's own catalogue photographs there, each linking to its product.
 */
export async function SocialGallery() {
  const posts = await getInstagramProvider().getRecentPosts(6);
  const tiles = posts.map((post) => ({
    key: post.id,
    imageUrl: post.imageUrl,
    caption: post.caption ?? "Social gallery image",
    href: post.permalink ?? null,
  }));

  return (
    <section className="container py-20">
      <ScrollReveal>
        <h2 className="mb-2 text-center font-heading text-3xl sm:text-4xl">Follow Along</h2>
        <p className="mb-10 text-center text-sm text-muted-foreground">@luxurylehengacouture</p>
      </ScrollReveal>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {tiles.length > 0
          ? tiles.map((tile, i) => {
              const image = (
                <StorefrontImage
                  src={tile.imageUrl}
                  alt={tile.caption}
                  sizes="(min-width: 640px) 16vw, 33vw"
                  className="object-cover transition-transform duration-500 hover:scale-105"
                />
              );
              return (
                <ScrollReveal key={tile.key} delay={i * 0.04}>
                  {tile.href ? (
                    <a
                      href={tile.href}
                      className="relative block aspect-square overflow-hidden rounded-lg"
                    >
                      {image}
                    </a>
                  ) : (
                    <div className="relative aspect-square overflow-hidden rounded-lg">{image}</div>
                  )}
                </ScrollReveal>
              );
            })
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

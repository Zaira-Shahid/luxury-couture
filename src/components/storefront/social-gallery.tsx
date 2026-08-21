import { ImageIcon } from "lucide-react";

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
                  <a href={post.permalink} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.imageUrl} alt={post.caption ?? ""} className="size-full object-cover" />
                  </a>
                ) : (
                  <div className="aspect-square overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.imageUrl} alt={post.caption ?? ""} className="size-full object-cover" />
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

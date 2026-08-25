import { StorefrontImage } from "@/components/shared/storefront-image";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

/**
 * The image panel used to be a hardcoded gradient div — a permanent grey
 * rectangle beside copy claiming hand embroidery by in-house artisans.
 *
 * It now reads `homepage.craft_image_url`, so the owner can change it
 * from the database like the hero, and falls back to the gradient rather
 * than to a broken image if the setting is empty.
 */
export async function CraftsmanshipSection() {
  const settings = await getSiteSettings();
  const imageUrl = settings.homepage.craftImageUrl;

  return (
    <section className="bg-secondary/50 py-20">
      <div className="container grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <ScrollReveal>
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-gradient-to-br from-muted to-secondary">
            {imageUrl ? (
              <StorefrontImage
                src={imageUrl}
                // Describes what is happening in the frame, because the
                // picture is carrying the section's argument rather than
                // decorating it.
                alt="An artisan setting pearls and beadwork by hand onto silk stretched over a wooden frame"
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            ) : null}
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">
            Our Craft
          </p>
          <h2 className="mt-3 font-heading text-3xl sm:text-4xl">
            Hand-Embroidered, Hand-Finished
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Every piece is cut and embroidered by our in-house artisans, using techniques passed
            down through generations — zardozi, gota, and dabka work, layered by hand over
            weeks, not machines in minutes.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}

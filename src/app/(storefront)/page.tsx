import type { Metadata } from "next";

import { CraftsmanshipSection } from "@/components/storefront/craftsmanship-section";
import { ConsultationCta } from "@/components/storefront/consultation-cta";
import { FeaturedCollections } from "@/components/storefront/featured-collections";
import { FeaturedProducts } from "@/components/storefront/featured-products";
import { Hero } from "@/components/storefront/hero";
import { NewsletterSection } from "@/components/storefront/newsletter-section";
import { ProcessSection } from "@/components/storefront/process-section";
import { SocialGallery } from "@/components/storefront/social-gallery";
import { Testimonials } from "@/components/storefront/testimonials";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: settings.homepage.seoTitle ?? undefined,
    description: settings.homepage.seoDescription ?? undefined,
  };
}

export default async function HomePage() {
  const settings = await getSiteSettings();

  return (
    <>
      <Hero
        heading={settings.homepage.heroHeading ?? "Couture, Made for You"}
        subheading={
          settings.homepage.heroSubheading ??
          "Bespoke lehengas, hand-crafted by our in-house artisans for your most important moments."
        }
        imageUrl={settings.homepage.heroImageUrl}
      />
      <FeaturedCollections />
      <FeaturedProducts />
      <CraftsmanshipSection />
      <ProcessSection />
      <Testimonials />
      <SocialGallery />
      <ConsultationCta contactEmail={settings.store.contactEmail} />
      <NewsletterSection />
    </>
  );
}

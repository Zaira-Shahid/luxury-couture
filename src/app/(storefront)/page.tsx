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
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/lib/config/site";
import { buildMetadata } from "@/lib/seo/build-metadata";
import { organizationSchema, websiteSchema } from "@/lib/seo/structured-data";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return buildMetadata({
    title: settings.homepage.seoTitle,
    description: settings.homepage.seoDescription,
    image: settings.homepage.heroImageUrl,
    path: "/",
    // The brand name is already the full title here, so skip the
    // "%s | Brand" template and avoid "Brand | Brand".
    absoluteTitle: true,
  });
}

export default async function HomePage() {
  const settings = await getSiteSettings();
  const brandName = settings.seo.defaultTitle ?? siteConfig.name;
  const brandDescription = settings.seo.defaultDescription ?? siteConfig.description;

  return (
    <>
      {/* Site-identity schema belongs on the home page only — repeating it
          on every route adds nothing and risks conflicting signals. */}
      <JsonLd
        data={organizationSchema({
          name: brandName,
          description: brandDescription,
          logoUrl: settings.branding.logoUrl,
          email: settings.store.contactEmail,
          phone: settings.store.contactPhone,
          address: settings.store.contactAddress,
          socialUrls: Object.values(settings.store.socialLinks).filter(
            (url): url is string => Boolean(url)
          ),
        })}
      />
      <JsonLd data={websiteSchema({ name: brandName, description: brandDescription })} />
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

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { CustomizeTeaser } from "@/components/storefront/customize-teaser";
import { ProductCard } from "@/components/storefront/product-card";
import { ProductEnquiryForm } from "@/components/storefront/product-enquiry-form";
import { ProductReviews, RatingSummary } from "@/components/storefront/product-reviews";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { StorefrontImage } from "@/components/shared/storefront-image";
import { WishlistButton } from "@/components/storefront/wishlist-button";
import { getAuthUser } from "@/lib/auth/session";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog/get-products";
import { siteConfig } from "@/lib/config/site";
import { getProductRatingSummary } from "@/lib/reviews/get-reviews";
import { buildMetadata } from "@/lib/seo/build-metadata";
import { getSeoMetadata } from "@/lib/seo/get-seo-metadata";
import { productSchema } from "@/lib/seo/structured-data";
import { getSiteSettings } from "@/lib/settings/get-site-settings";
import { getWishlistedProductIds } from "@/lib/wishlist/get-wishlist";

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product" };

  const overrides = await getSeoMetadata("product", product.id);
  const primaryImage =
    product.product_images.find((img) => img.is_primary) ?? product.product_images[0];

  return buildMetadata({
    title: product.name,
    description: product.description,
    image: primaryImage?.url,
    path: `/products/${product.slug}`,
    overrides,
  });
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [related, user, wishlistedIds, rating, settings] = await Promise.all([
    getRelatedProducts(product),
    getAuthUser(),
    getWishlistedProductIds(),
    // Reused from Module 18 — already React-cached, so the visible
    // RatingSummary below does not re-query for this.
    getProductRatingSummary(product.id),
    getSiteSettings(),
  ]);

  const images = [...product.product_images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.sort_order - b.sort_order;
  });

  return (
    <div className="container py-16">
      <JsonLd
        data={productSchema({
          name: product.name,
          description: product.description,
          path: `/products/${product.slug}`,
          sku: product.sku,
          images: images.map((img) => img.url),
          price: product.base_price,
          currency: product.currency,
          brandName: settings.seo.defaultTitle ?? siteConfig.name,
          rating,
        })}
      />
      <Breadcrumbs
        className="mb-8"
        items={[
          { name: "Home", path: "/" },
          { name: "Products", path: "/products" },
          { name: product.name, path: `/products/${product.slug}` },
        ]}
      />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
            {images[0] ? (
              <StorefrontImage
                src={images[0].url}
                alt={images[0].alt_text ?? product.name}
                sizes="(min-width: 1024px) 50vw, 100vw"
                // The main product shot is the largest-contentful element
                // on this page — load it eagerly rather than lazily.
                priority
                className="object-cover"
              />
            ) : (
              <div className="size-full bg-gradient-to-br from-secondary to-muted" />
            )}
          </div>
          {images.length > 1 ? (
            <div className="grid grid-cols-4 gap-3">
              {images.slice(1).map((img) => (
                <div
                  key={img.id}
                  className="relative aspect-square overflow-hidden rounded-lg bg-muted"
                >
                  <StorefrontImage
                    src={img.url}
                    alt={img.alt_text ?? product.name}
                    sizes="(min-width: 1024px) 12vw, 25vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <h1 className="font-heading text-4xl">{product.name}</h1>
          <p className="mt-2 text-xl text-muted-foreground">
            {formatPrice(product.base_price, product.currency)}
          </p>
          <RatingSummary productId={product.id} />
          {product.description ? (
            <p className="mt-6 text-muted-foreground">{product.description}</p>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <AddToCartButton productId={product.id} />
            <WishlistButton
              productId={product.id}
              initiallyWishlisted={wishlistedIds.has(product.id)}
              isSignedIn={!!user}
            />
          </div>

          <div className="mt-8">
            <CustomizeTeaser productSlug={product.slug} />
          </div>

          <div className="mt-8">
            <p className="mb-3 font-heading text-lg">Enquire About This Piece</p>
            <ProductEnquiryForm productName={product.name} productSlug={product.slug} />
          </div>
        </div>
      </div>

      <ProductReviews productId={product.id} />

      {related.length > 0 ? (
        <section className="mt-20">
          <ScrollReveal>
            <h2 className="mb-8 font-heading text-3xl">You May Also Like</h2>
          </ScrollReveal>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

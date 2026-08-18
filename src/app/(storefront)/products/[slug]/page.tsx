import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomizeTeaser } from "@/components/storefront/customize-teaser";
import { ProductCard } from "@/components/storefront/product-card";
import { ProductEnquiryForm } from "@/components/storefront/product-enquiry-form";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { WishlistButton } from "@/components/storefront/wishlist-button";
import { getAuthUser } from "@/lib/auth/session";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog/get-products";
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
  return { title: product?.name ?? "Product" };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [related, user, wishlistedIds] = await Promise.all([
    getRelatedProducts(product),
    getAuthUser(),
    getWishlistedProductIds(),
  ]);

  const images = [...product.product_images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.sort_order - b.sort_order;
  });

  return (
    <div className="container py-16">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="aspect-[3/4] overflow-hidden rounded-xl bg-muted">
            {images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={images[0].url}
                alt={images[0].alt_text ?? product.name}
                className="size-full object-cover"
              />
            ) : (
              <div className="size-full bg-gradient-to-br from-secondary to-muted" />
            )}
          </div>
          {images.length > 1 ? (
            <div className="grid grid-cols-4 gap-3">
              {images.slice(1).map((img) => (
                <div key={img.id} className="aspect-square overflow-hidden rounded-lg bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt_text ?? product.name}
                    className="size-full object-cover"
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
          {product.description ? (
            <p className="mt-6 text-muted-foreground">{product.description}</p>
          ) : null}

          <div className="mt-6">
            <WishlistButton
              productId={product.id}
              initiallyWishlisted={wishlistedIds.has(product.id)}
              isSignedIn={!!user}
            />
          </div>

          <div className="mt-8">
            <CustomizeTeaser />
          </div>

          <div className="mt-8">
            <p className="mb-3 font-heading text-lg">Enquire About This Piece</p>
            <ProductEnquiryForm productName={product.name} productSlug={product.slug} />
          </div>
        </div>
      </div>

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

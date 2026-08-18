import Link from "next/link";

import type { ProductWithImages } from "@/lib/catalog/get-products";

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export function ProductCard({ product }: { product: ProductWithImages }) {
  const primaryImage =
    product.product_images.find((img) => img.is_primary) ?? product.product_images[0];

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="aspect-[3/4] overflow-hidden rounded-lg bg-muted">
        {primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryImage.url}
            alt={primaryImage.alt_text ?? product.name}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="size-full bg-gradient-to-br from-secondary to-muted" />
        )}
      </div>
      <p className="mt-3 text-sm">{product.name}</p>
      <p className="text-sm text-muted-foreground">
        {formatPrice(product.base_price, product.currency)}
      </p>
    </Link>
  );
}

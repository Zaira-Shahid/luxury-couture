import Link from "next/link";
import { formatMoney } from "@/lib/settings/format";


import { StorefrontImage } from "@/components/shared/storefront-image";
import type { ProductWithImages } from "@/lib/catalog/get-products";

export function ProductCard({ product }: { product: ProductWithImages }) {
  const primaryImage =
    product.product_images.find((img) => img.is_primary) ?? product.product_images[0];

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
        {primaryImage ? (
          <StorefrontImage
            src={primaryImage.url}
            alt={primaryImage.alt_text ?? product.name}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="size-full bg-gradient-to-br from-secondary to-muted" />
        )}
      </div>
      <p className="mt-3 text-sm">{product.name}</p>
      <p className="text-sm text-muted-foreground">
        {formatMoney(product.base_price, product.currency)}
      </p>
    </Link>
  );
}

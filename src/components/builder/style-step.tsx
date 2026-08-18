"use client";

import { cn } from "@/lib/utils";
import type { ProductWithImages } from "@/lib/catalog/get-products";

export function StyleStep({
  products,
  selectedId,
  onSelect,
}: {
  products: ProductWithImages[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div>
      <h2 className="font-heading text-2xl">Choose a Starting Style</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Start from one of our pieces, or design something fully custom.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border p-3 text-center text-sm transition-colors",
            selectedId === null
              ? "border-primary ring-1 ring-primary"
              : "border-border hover:border-foreground/30"
          )}
        >
          <span className="flex aspect-[3/4] w-full items-center justify-center rounded-md bg-gradient-to-br from-secondary to-muted text-xs text-muted-foreground">
            Fully Custom
          </span>
          <span>No base style</span>
        </button>

        {products.map((product) => {
          const primaryImage =
            product.product_images.find((img) => img.is_primary) ?? product.product_images[0];
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelect(product.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-3 text-center text-sm transition-colors",
                selectedId === product.id
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-foreground/30"
              )}
            >
              {primaryImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={primaryImage.url}
                  alt={product.name}
                  className="aspect-[3/4] w-full rounded-md object-cover"
                />
              ) : (
                <span className="flex aspect-[3/4] w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                  {product.name}
                </span>
              )}
              <span>{product.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

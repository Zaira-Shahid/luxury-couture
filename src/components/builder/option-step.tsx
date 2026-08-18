"use client";

import { cn } from "@/lib/utils";

type OptionLike = {
  id: string;
  name: string;
  description?: string | null;
  hex_value?: string | null;
  image_url: string | null;
  price_adjustment: number;
};

function formatAdjustment(amount: number) {
  if (amount === 0) return null;
  const formatted = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    Math.abs(amount)
  );
  return amount > 0 ? `+${formatted}` : `-${formatted}`;
}

export function OptionStep({
  title,
  description,
  options,
  selectedId,
  onSelect,
  optional = true,
}: {
  title: string;
  description: string;
  options: OptionLike[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  optional?: boolean;
}) {
  return (
    <div>
      <h2 className="font-heading text-2xl">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {optional ? (
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
            <span className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
              None
            </span>
            <span>Skip this</span>
          </button>
        ) : null}

        {options.map((option) => {
          const adjustment = formatAdjustment(option.price_adjustment);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-3 text-center text-sm transition-colors",
                selectedId === option.id
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-foreground/30"
              )}
            >
              {option.hex_value ? (
                <span
                  className="aspect-square w-full rounded-md ring-1 ring-foreground/10"
                  style={{ backgroundColor: option.hex_value }}
                />
              ) : option.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={option.image_url}
                  alt={option.name}
                  className="aspect-square w-full rounded-md object-cover"
                />
              ) : (
                <span className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                  {option.name}
                </span>
              )}
              <span>{option.name}</span>
              {adjustment ? <span className="text-xs text-muted-foreground">{adjustment}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

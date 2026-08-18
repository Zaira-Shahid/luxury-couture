import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BuilderOptionSets } from "@/lib/builder/get-options";
import type { ProductWithImages } from "@/lib/catalog/get-products";

type Selections = {
  productId: string | null;
  fabricId: string | null;
  embroideryTypeId: string | null;
  colourId: string | null;
  sleeveStyleId: string | null;
  necklineId: string | null;
  dupattaOptionId: string | null;
};

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

export function PreviewPanel({
  selections,
  options,
  products,
  estimatedPrice,
}: {
  selections: Selections;
  options: BuilderOptionSets;
  products: ProductWithImages[];
  estimatedPrice: number;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Style", value: products.find((p) => p.id === selections.productId)?.name ?? "Fully custom" },
    { label: "Fabric", value: options.fabrics.find((f) => f.id === selections.fabricId)?.name ?? "—" },
    {
      label: "Embroidery",
      value: options.embroidery.find((e) => e.id === selections.embroideryTypeId)?.name ?? "—",
    },
    { label: "Colour", value: options.colours.find((c) => c.id === selections.colourId)?.name ?? "—" },
    {
      label: "Sleeve",
      value: options.sleeveStyles.find((s) => s.id === selections.sleeveStyleId)?.name ?? "—",
    },
    {
      label: "Neckline",
      value: options.necklines.find((n) => n.id === selections.necklineId)?.name ?? "—",
    },
    {
      label: "Dupatta",
      value: options.dupattaOptions.find((d) => d.id === selections.dupattaOptionId)?.name ?? "—",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Design</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="text-right">{row.value}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
          <span>Estimated price</span>
          <span>{formatPrice(estimatedPrice)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Estimate only — your final quote is confirmed by our design team.
        </p>
      </CardContent>
    </Card>
  );
}

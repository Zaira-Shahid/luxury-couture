import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getCustomizeTeaserOptions } from "@/lib/catalog/get-builder-options";

export async function CustomizeTeaser() {
  const { fabrics, embroidery, colours } = await getCustomizeTeaserOptions();
  if (fabrics.length === 0 && embroidery.length === 0 && colours.length === 0) return null;

  return (
    <div className="rounded-xl bg-secondary/50 p-6">
      <p className="font-heading text-lg">Customize This Piece</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Available in a range of fabrics, colours, and hand embroidery — design your own version
        with our Custom Builder.
      </p>
      <div className="mt-4 flex flex-col gap-3 text-sm">
        {fabrics.length ? (
          <p>
            <span className="text-muted-foreground">Fabrics: </span>
            {fabrics.map((f) => f.name).join(", ")}
          </p>
        ) : null}
        {embroidery.length ? (
          <p>
            <span className="text-muted-foreground">Embroidery: </span>
            {embroidery.map((e) => e.name).join(", ")}
          </p>
        ) : null}
        {colours.length ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Colours: </span>
            <div className="flex gap-1">
              {colours.map((c) => (
                <span
                  key={c.id}
                  title={c.name}
                  className="size-5 rounded-full ring-1 ring-foreground/15"
                  style={{ backgroundColor: c.hex_value ?? undefined }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <Button render={<Link href="/builder" />} className="mt-4">
        Open Custom Builder
      </Button>
    </div>
  );
}

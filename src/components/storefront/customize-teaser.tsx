import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getCustomizeTeaserOptions } from "@/lib/catalog/get-builder-options";

/**
 * THE COLOUR SWATCHES WERE REMOVED, deliberately, and this note is here
 * so nobody adds them back without reading why.
 *
 * They were a row of eight coloured dots. They looked like variant
 * selectors and were not: they came from `getCustomizeTeaserOptions()`,
 * which returns the Custom Builder's global palette — the SAME eight
 * colours on every product page, unrelated to the piece being viewed.
 * Clicking one did nothing, because it was a `<span>`.
 *
 * So they made two false claims at once: that this garment comes in
 * those colours, and that you could switch between them.
 *
 * The obvious fix — make them switch the photograph — is not available.
 * That needs a second photograph per colour, and every product in the
 * catalogue has exactly one image. Wiring up a swatch that changes
 * nothing, or that shows the same picture in every "colour", would be
 * the same lie with more code behind it. Real variant support means a
 * `colour_id` on `product_images` AND photographs to hang off it; when
 * those photographs exist, that is the thing to build.
 *
 * The fabrics and embroidery lines stay because they are true as
 * written: they are labelled as Custom Builder options, not as this
 * product's attributes.
 */
export async function CustomizeTeaser({ productSlug }: { productSlug?: string } = {}) {
  const { fabrics, embroidery } = await getCustomizeTeaserOptions();
  if (fabrics.length === 0 && embroidery.length === 0) return null;

  return (
    <div className="rounded-xl bg-secondary/50 p-6">
      <p className="font-heading text-lg">Customize This Piece</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Prefer this in a different fabric, colour or embroidery? Start from your own
        specification in the Custom Builder — these are the options it offers.
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
      </div>
      <Button
        render={<Link href={productSlug ? `/builder?product=${productSlug}` : "/builder"} />}
        className="mt-4"
      >
        Open Custom Builder
      </Button>
    </div>
  );
}

/**
 * The Western Wear collection.
 *
 * Eight images supplied, six used. Same rule as the other collections:
 * each file was opened and looked at before the product beside it was
 * written, and the copy claims only what is visible in the frame.
 *
 * A NOTE ON THE TWO EXISTING WESTERN WEAR PRODUCTS. The owner asked
 * whether these should go to Zara Emerald Reception Gown or Isla
 * Champagne Two-Piece. Neither, and the reason is simple: all eight
 * photographs are ivory or white bridal gowns. Zara is emerald and Isla
 * is champagne, and neither is white. Attaching one anyway would put the
 * catalogue straight back into the mismatch this whole exercise has been
 * correcting. Both keep the photographs they already have and are
 * reported in the status summary instead.
 */

export const WESTERN_IMAGE_DIR = ".western";

export const UNUSED = [
  {
    image: "w02.jpg",
    saw: "ivory lace-sleeved ballgown with a tulle skirt and a lace-edged veil — but the groom, in a black cowboy hat and suit, occupies roughly half the frame and is the sharper subject",
    why: "the gown is the smaller half of a couple's portrait; a product card cropped from this would be mostly hat",
  },
  {
    image: "w06.jpg",
    saw: "ivory tulle gown with sheer puff sleeves and a corseted bodice, worn with black combat boots",
    why: "'Unsplash+' watermark tiled across the whole frame — it is a paid-tier image and the free URL returns the watermarked copy",
  },
];

/** No existing product is a colour match; see the note above. */
export const REPLACEMENTS = [];

export const WESTERN_PRODUCTS = [
  {
    slug: "seraphine-ivory-illusion-back-gown",
    name: "Seraphine Ivory Illusion-Back Gown",
    image: "w01.jpg",
    saw: "ivory A-line gown photographed from behind: a sheer illusion back closed with a long row of covered buttons, beaded scrollwork over the shoulders, embroidered lace sleeves to the wrist, and a wide embroidered train pooling on the ground",
    categorySlug: "western-wear",
    occasions: ["reception", "engagement"],
    price: 2450,
    featured: true,
    description:
      "The back is the front of this dress. A sheer illusion panel runs from the neck to the waist, closed with a long row of covered buttons, with beaded scrollwork worked across the shoulders and down the spine.\n\nLace sleeves to the wrist, an A-line skirt in tulle over satin, and a wide embroidered train. It photographs best walking away, which is worth planning for.",
  },
  {
    slug: "celeste-ivory-cathedral-train-gown",
    name: "Celeste Ivory Cathedral-Train Gown",
    image: "w08.jpg",
    saw: "ivory lace sheath gown with fine straps, a scalloped lace hem and an extremely long cathedral train spread out behind, worn with a matching lace-edged veil, photographed outdoors from behind",
    categorySlug: "western-wear",
    occasions: ["reception"],
    price: 2650,
    featured: true,
    description:
      "A close-cut lace sheath on fine straps, with a cathedral train that runs several feet behind and finishes in a scalloped lace edge.\n\nThe train is the piece. It is detachable at the waist, because a train this length is unmanageable once the dancing starts, and the dress underneath is a clean column that stands on its own.",
  },
  {
    slug: "verity-ivory-lace-fit-and-flare-gown",
    name: "Verity Ivory Lace Fit-and-Flare Gown",
    image: "w04.jpg",
    saw: "ivory strapless fit-and-flare gown in a large-scale botanical lace over a nude lining, with a long lace-edged cathedral veil lifting sideways, photographed on a hillside at dusk",
    categorySlug: "western-wear",
    occasions: ["reception", "engagement"],
    price: 2280,
    description:
      "Large-scale botanical lace laid over a nude lining, so the pattern reads as if it sits on skin rather than on fabric. Strapless, boned through the bodice, and flared from just below the hip.\n\nSupplied with the lace-edged veil shown. The lace repeat is deliberately large — at this scale it stays legible in photographs taken from across a room.",
  },
  {
    slug: "marisol-champagne-ruffle-mermaid-gown",
    name: "Marisol Champagne Ruffle Mermaid Gown",
    image: "w07.jpg",
    saw: "champagne-ivory strapless mermaid gown with a densely beaded and appliquéd bodice and a full skirt of layered raw-edged organza ruffles, photographed outdoors at sunset",
    categorySlug: "western-wear",
    occasions: ["reception"],
    price: 2150,
    description:
      "Champagne rather than white — warmer against most skin tones, and it stops the beading from disappearing into the fabric.\n\nThe bodice is beaded and appliquéd solid; the skirt is layered organza cut with a raw edge, so the ruffles hold their shape without hemming. Strapless, seamed to the knee and then released.",
  },
  {
    slug: "juniper-ivory-beaded-a-line-gown",
    name: "Juniper Ivory Beaded A-Line Gown",
    image: "w05.jpg",
    saw: "ivory A-line gown with a deep V neckline and fine shoulder straps, embroidered all over in tonal floral lace with scattered crystal and pearl beading, photographed outdoors in bright daylight",
    categorySlug: "western-wear",
    occasions: ["reception", "engagement"],
    price: 1980,
    description:
      "Tonal floral lace embroidered over the whole gown, with crystals and small pearls scattered through it rather than concentrated in one panel — so it catches light evenly instead of flashing in one place.\n\nDeep V neckline on fine straps, A-line skirt with a soft pleat at the waist. The most straightforward cut in the collection and the easiest to alter.",
  },
  {
    slug: "wren-ivory-lace-collar-day-dress",
    name: "Wren Ivory Lace-Collar Day Dress",
    image: "w03.jpg",
    saw: "ivory crinkle-cotton dress with a wide scalloped lace collar, ruffled cap detail at the shoulder, full bishop sleeves gathered at the wrist and a dropped gathered waist, photographed outdoors in low sun",
    categorySlug: "western-wear",
    occasions: ["engagement"],
    price: 640,
    description:
      "Crinkle cotton rather than silk or lace, with a wide scalloped lace collar, full bishop sleeves and a dropped gathered waist.\n\nThe only unlined, un-beaded piece in this collection, and by some distance the cheapest. Made for a registry office, a garden engagement or a photo shoot rather than a ballroom — and it can be washed.",
  },
];

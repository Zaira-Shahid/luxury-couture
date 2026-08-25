/**
 * The Reception collection — written FROM the photographs.
 *
 * Same rule as the Mehndi and Nikkah collections: every file in
 * `.reception/` was opened and looked at before the product beside it was
 * written. The `saw` note is a description of what is in the frame, and
 * every claim in the product copy has to be traceable to it.
 *
 * That last part is the point. The copy below describes colour, fabric
 * weight, silhouette, sleeve length and trim, because those are visible.
 * It does not invent provenance, workshop hours, thread counts or
 * heritage — none of that is in a photograph, and inventing it is what
 * "faltu ya false na likho" rules out.
 *
 * Reception pieces are priced above mehndi and roughly level with nikkah
 * (£1,380–£2,600): these are the heaviest, most embroidered garments in
 * the catalogue.
 */

export const RECEPTION_IMAGE_DIR = ".reception";

/** Supplied but not attached, with the reason. */
export const UNUSED = [
  {
    image: "r11.jpg",
    saw: "gold beaded kameez with a gold net dupatta, photographed outdoors at sunset",
    why: "a photographer's watermark — 'Clicks Newton' plus a phone number — is tiled across the middle of the frame. That is someone else's branding and contact details; it cannot go on a product page.",
  },
];

/**
 * Images for products that already exist.
 *
 * Both were still carrying a placeholder or a mismatched bulk fetch, and
 * both of these photographs are an exact colour match to the product's
 * own name — which is why they replace an image rather than becoming
 * additional products.
 */
export const REPLACEMENTS = [
  {
    slug: "aisha-midnight-sharara",
    image: "r06.jpg",
    saw: "midnight navy velvet worked all over in silver and gold floral embroidery, with a long ivory net dupatta edged in the same work, photographed in a hotel lobby",
    why: "the product is called Midnight and this is midnight navy velvet",
  },
  {
    slug: "raya-slate-cocktail-lehenga",
    image: "r12.jpg",
    saw: "pewter-grey net kameez with silver floral embroidery and a matching grey net dupatta, worn with heavy gold kundan jewellery",
    why: "the product is called Slate and this is the only true grey in the set; it was on a generated gradient",
  },
];

export const RECEPTION_PRODUCTS = [
  {
    slug: "aiman-ivory-maroon-trailing-gown",
    name: "Aiman Ivory & Maroon Trailing Gown",
    image: "r10.jpg",
    saw: "floor-length ivory front-open gown embroidered in gold and pastel florals, worn over a deep maroon underskirt with gold work, with a long trailing dupatta pooled on the floor behind",
    categorySlug: "asian-wear",
    occasions: ["reception", "nikkah"],
    price: 2600,
    featured: true,
    description:
      "An ivory front-open gown embroidered in gold with pastel florals worked through it, open the full length so the maroon underskirt shows as you walk.\n\nThe dupatta is long enough to trail — in the photograph it pools well behind the hem. That is how it is cut and it is not a short option; if you want it to clear the floor, say so when ordering.",
  },
  {
    slug: "warda-pearl-grey-zardozi-lehenga",
    name: "Warda Pearl Grey Zardozi Lehenga",
    image: "r04.jpg",
    saw: "pale pearl-grey silk kameez covered in heavy raised gold zardozi, cap sleeves, worn with a sheer gold-edged veil over the head and a gold-bordered skirt",
    categorySlug: "asian-wear",
    occasions: ["reception", "nikkah"],
    price: 2400,
    featured: true,
    description:
      "Pearl-grey silk under heavy raised gold zardozi — the embroidery sits proud of the fabric rather than flat in it, which is what gives the surface its depth under lighting.\n\nCap sleeves as photographed, and a sheer gold-edged veil worn over the head rather than across the shoulder. Grey and gold is a quieter reception palette than red and gold, and it reads much better in photographs taken with flash.",
  },
  {
    slug: "sabeen-peacock-velvet-reception-lehenga",
    name: "Sabeen Peacock Velvet Reception Lehenga",
    image: "r05.jpg",
    saw: "peacock-teal velvet with dense gold, pearl and crystal embroidery across the bodice and sleeves, worn with a matching teal net dupatta over the head",
    categorySlug: "asian-wear",
    occasions: ["reception", "nikkah"],
    price: 2250,
    description:
      "Peacock teal velvet, embroidered in gold with pearl and crystal set into the work so it catches light from more than one angle.\n\nThe sleeves are worked as heavily as the bodice and finish at the wrist. The dupatta is teal net edged to match and is worn over the head in the photograph — it is a single width, not a double.",
  },
  {
    slug: "simran-wine-velvet-reception-lehenga",
    name: "Simran Wine Velvet Reception Lehenga",
    image: "r01.jpg",
    saw: "wine-maroon velvet lehenga with panelled embroidery in gold, blue, red and cream, long worked sleeves, beaded fringe at the waist",
    categorySlug: "asian-wear",
    occasions: ["reception", "baraat"],
    price: 2150,
    description:
      "Wine velvet worked in panels rather than an all-over pattern — each panel is embroidered separately in gold with blue, red and cream picked out, so the skirt reads as a series of framed motifs.\n\nLong sleeves embroidered to match, and a beaded fringe hanging from the waistband. This is a heavy piece; the velvet alone gives it weight before any of the work goes on.",
  },
  {
    slug: "ifra-brick-red-reception-gown",
    name: "Ifra Brick Red Reception Gown",
    image: "r02.jpg",
    saw: "brick-red sheer front-open gown in a dense gold trellis pattern with floral sprigs on the sleeves, worn over a matching red lehenga with a red net dupatta",
    categorySlug: "asian-wear",
    occasions: ["reception", "baraat"],
    price: 1950,
    description:
      "Brick red rather than a true crimson — warmer, and a good deal easier to wear if scarlet does not suit you.\n\nThe gown is sheer and front-open, worked in a gold trellis with a repeating motif at each crossing, over a matching lehenga underneath. The sleeves carry a lighter floral sprig so the arms do not add to the weight.",
  },
  {
    slug: "zoha-champagne-front-open-gown",
    name: "Zoha Champagne Front-Open Gown",
    image: "r09.jpg",
    saw: "champagne-gold sheer front-open gown with pastel floral embroidery and pearl work down the front, long fitted sleeves, worn with a printed floral dupatta in muted browns and greens",
    categorySlug: "asian-wear",
    occasions: ["reception", "engagement"],
    price: 1890,
    description:
      "Champagne gold with pastel florals and pearl work concentrated down the front opening, where it is actually seen.\n\nThe dupatta is the unusual part: printed in muted browns and greens rather than embroidered to match, which is what stops the whole outfit reading as one continuous gold surface. Long fitted sleeves.",
  },
  {
    slug: "mehrbano-teal-gota-gharara",
    name: "Mehrbano Teal Gota Gharara",
    image: "r08.jpg",
    saw: "deep teal silk gharara with gold gota work and pink and yellow floral embroidery, gold tinsel fringe along the sleeve and hem edges, matching teal net dupatta",
    categorySlug: "asian-wear",
    occasions: ["reception", "mehndi"],
    price: 1680,
    description:
      "Deep teal silk with gold gota laid over it and pink and yellow flowers worked into the borders — a warmer, more traditional combination than teal with gold alone.\n\nGold tinsel fringe runs along the sleeve openings and the hem of the kameez. Elbow-length sleeves as photographed.",
  },
  {
    slug: "naila-plum-ivory-reception-lehenga",
    name: "Naila Plum & Ivory Reception Lehenga",
    image: "r03.jpg",
    saw: "dusty plum blouse with pink and gold scalloped border work, worn with an ivory sequinned net skirt and a blush net dupatta edged in gold",
    categorySlug: "asian-wear",
    occasions: ["reception", "engagement"],
    price: 1750,
    description:
      "A dusty plum blouse over an ivory sequinned net skirt, with a blush dupatta — three tones close enough to sit together and different enough not to look like one piece.\n\nThe blouse border is scalloped and worked in pink and gold. The skirt is sequinned all over rather than bordered, so it lifts under lighting without adding embroidery weight.",
  },
  {
    slug: "sadia-lilac-mist-reception-lehenga",
    name: "Sadia Lilac Mist Reception Lehenga",
    image: "r13.jpg",
    saw: "pale grey-lilac net lehenga with white and powder-blue floral embroidery in scalloped tiers, sheer net sleeves, matching dupatta with a silver border",
    categorySlug: "asian-wear",
    occasions: ["reception", "engagement"],
    price: 1550,
    description:
      "Grey-lilac net with white and powder-blue florals worked in scalloped tiers down the skirt, so each tier finishes in a curved edge rather than a straight line.\n\nThe sleeves are sheer net and the dupatta carries a silver border. The lightest reception piece here — nothing on it is velvet or heavily beaded, which matters if you are wearing it through a long dinner.",
  },
  {
    slug: "hania-champagne-beaded-kameez",
    name: "Hania Champagne Beaded Kameez",
    image: "r07.jpg",
    saw: "champagne net kameez densely beaded in silver, gold and amber with a V neckline, sheer net sleeves, worn with a matching champagne dupatta",
    categorySlug: "asian-wear",
    occasions: ["reception", "engagement"],
    price: 1450,
    description:
      "Champagne net beaded in silver, gold and amber — three metallics rather than one, which keeps it from flattening into a single gold block under warm lighting.\n\nV neckline and sheer net sleeves worked to the cuff. Cut as a straight kameez rather than a flared one, and worn here with a matching plain dupatta.",
  },
  {
    slug: "amara-blush-tulle-reception-gown",
    name: "Amara Blush Tulle Reception Gown",
    image: "r14.jpg",
    saw: "blush-pink tulle gown with a beaded bodice in gold and rose, cold-shoulder straps with hanging bead fringe, full soft tulle skirt with scattered motifs",
    categorySlug: "western-wear",
    occasions: ["reception", "engagement"],
    price: 1380,
    description:
      "Blush tulle with a beaded bodice in gold and rose, and cold-shoulder straps finished with a short bead fringe.\n\nThe skirt is full and soft rather than structured — several layers of tulle with small motifs scattered through it, no boning and no underskirt hoop. Filed under Western Wear because that is what it is: a gown, not a lehenga.",
  },
];

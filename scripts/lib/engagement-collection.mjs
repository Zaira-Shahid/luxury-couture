/**
 * The Engagement collection.
 *
 * A NOTE ON THIS BATCH, because it differs from the other three.
 *
 * Fifteen images were supplied and SEVEN are used. That is a much lower
 * hit rate than Nikkah, Mehndi or Reception, and the reason is not
 * quality — it is subject. Searching "engagement" returns photographs of
 * the MOMENT: rings being placed, clasped hands, bouquets. Eight of the
 * fifteen are exactly that. They are lovely photographs and there is no
 * garment in them to sell, so there is nothing truthful to write on a
 * product page beneath one.
 *
 * Two of the eight carry an "Unsplash+" watermark tiled across the whole
 * frame as well — those are the paid-tier images, and the free URL
 * returns the watermarked copy.
 *
 * Every rejection is listed in UNUSED with its reason. Nothing was
 * dropped quietly, and no product was invented to justify keeping an
 * image.
 *
 * Priced £980–£1,580: below reception and nikkah, above mehndi.
 */

export const ENGAGEMENT_IMAGE_DIR = ".engagement";

export const UNUSED = [
  {
    image: "e01.jpg",
    saw: "a hand wearing a solitaire ring resting on white tulle",
    why: "'Unsplash+' watermark tiled across the frame, AND no garment — it is a ring photograph",
  },
  {
    image: "e03.jpg",
    saw: "a couple's hands holding a pink rose bouquet; her pink outfit is out of focus behind",
    why: "the garment is background blur, and a man's arm and watch are the second subject",
  },
  {
    image: "e04.jpg",
    saw: "a gold ring being placed on a finger, two pairs of hands, lilac sequinned fabric below",
    why: "hands and a ring; the outfit is a corner of blurred fabric",
  },
  {
    image: "e05.jpg",
    saw: "a solitaire ring on a hand held in another hand, dark suit behind",
    why: "no garment in frame at all — and nothing South Asian to place in this catalogue",
  },
  {
    image: "e06.jpg",
    saw: "clasped hands with a solitaire ring, a plain cream shift dress and a grey suit behind",
    why: "the dress is a plain unembellished background; there is no piece to sell",
  },
  {
    image: "e07.jpg",
    saw: "a close-up of a coral rose and gypsophila bouquet",
    why: "flowers, not clothing",
  },
  {
    image: "e10.jpg",
    saw: "a rose-brown dress with sequinned cuffs, holding a dried bouquet",
    why: "'Unsplash+' watermark tiled across the whole frame",
  },
  {
    image: "e11.jpg",
    saw: "a champagne-gold outfit, hand extended to show a ring",
    why: "the focus is on the ring — the garment is soft throughout, so no detail of it is legible",
  },
];

export const ENGAGEMENT_PRODUCTS = [
  {
    slug: "rida-rose-chanderi-anarkali",
    name: "Rida Rose Chanderi Anarkali",
    image: "e15.jpg",
    saw: "full-length rose-pink chanderi anarkali with gold gota work at the neckline, cuffs and a deep hem border, worn over a gold underskirt with a pink net dupatta edged in gold, photographed outdoors on grass",
    categorySlug: "asian-wear",
    occasions: ["engagement", "mehndi"],
    price: 1150,
    featured: true,
    description:
      "Rose-pink chanderi with gold gota at the neckline, the cuffs and a deep border at the hem. The gold underskirt shows below the anarkali rather than being hidden by it.\n\nChanderi has a visible slub and a slight sheen, which is why the colour shifts between pink and a deeper rose as the light moves. The dupatta is pink net with a gold border and a scattered star motif.",
  },
  {
    slug: "zainab-ice-blue-engagement-lehenga",
    name: "Zainab Ice Blue Engagement Lehenga",
    image: "e09.jpg",
    saw: "ice-blue net lehenga embroidered in peach and gold florals with pearl centres, worn with a gold beaded kameez and heavily worked gold cuffs",
    categorySlug: "asian-wear",
    occasions: ["engagement", "reception"],
    price: 1580,
    featured: true,
    description:
      "Ice-blue net with peach and gold florals, each flower centred with a small pearl, over a gold beaded kameez.\n\nThe cuffs are the heaviest part of the piece — worked solid in gold beadwork to about four inches — which is deliberate on a sitting-down outfit, because the sleeves are what people see across a table.",
  },
  {
    slug: "anum-dusty-rose-engagement-lehenga",
    name: "Anum Dusty Rose Engagement Lehenga",
    image: "e13.jpg",
    saw: "dusty rose net lehenga with silver-gold floral embroidery and large pink lotus motifs on the skirt, a crystal-set neckline, and a blush net dupatta with a wide gold border",
    categorySlug: "asian-wear",
    occasions: ["engagement", "reception"],
    price: 1450,
    description:
      "Dusty rose net worked in silver and gold, with pink lotus motifs across the skirt — the lotuses are the only place real colour is used, so they read from a distance while the rest stays tonal.\n\nThe neckline is set with crystals rather than embroidered. The dupatta is blush net with a wide gold border and is worn over the head in the photograph.",
  },
  {
    slug: "hooriya-powder-blue-beaded-lehenga",
    name: "Hooriya Powder Blue Beaded Lehenga",
    image: "e08.jpg",
    saw: "powder-blue net lehenga with silver and gold floral embroidery and pearl centres, worn over a gold underskirt, with a tiered gold beaded cuff at the wrist",
    categorySlug: "asian-wear",
    occasions: ["engagement", "reception"],
    price: 1390,
    description:
      "Powder blue net over a gold underskirt, so the gold reads through the net rather than sitting on top of it. Silver and gold florals with pearl centres scattered across the surface.\n\nThe cuff is beaded in tiers and finishes wide at the wrist. A cooler, quieter alternative to the pinks and golds that dominate engagement wear.",
  },
  {
    slug: "eshal-champagne-mint-engagement-set",
    name: "Eshal Champagne & Mint Engagement Set",
    image: "e12.jpg",
    saw: "champagne net kameez with rose-gold floral appliqué on the bodice and sleeves, a pearl-edged net dupatta over the head, and a mint-green gathered skirt below",
    categorySlug: "asian-wear",
    occasions: ["engagement"],
    price: 1250,
    description:
      "Champagne net with rose-gold floral appliqué worked over the bodice and down the sleeves, and a mint-green gathered skirt underneath.\n\nChampagne with mint is an unusual pairing and it is the reason to choose this one — most engagement wear puts gold with pink. The dupatta is edged with a line of pearls rather than a border.",
  },
  {
    slug: "elena-blush-lace-gown",
    name: "Elena Blush Lace Gown",
    image: "e02.jpg",
    saw: "blush-pink lace gown with a beaded sweetheart bodice, scalloped lace edging at the shoulders and cuffs, long sheer sleeves and a lattice-worked waist",
    categorySlug: "western-wear",
    occasions: ["engagement"],
    price: 1290,
    description:
      "Blush lace over a matching lining, with a beaded sweetheart bodice and a lattice-worked panel at the waist. The lace is scalloped at the shoulders and again at the cuffs.\n\nLong sheer sleeves. Filed under Western Wear because it is cut as a gown — there is no dupatta and no separate skirt.",
  },
  {
    slug: "nimra-ivory-lace-gold-set",
    name: "Nimra Ivory Lace & Gold Set",
    image: "e14.jpg",
    saw: "ivory chantilly lace top with scalloped edges and two crystal brooch clasps at the front, worn over a gold woven songket-patterned skirt",
    categorySlug: "asian-wear",
    occasions: ["engagement"],
    price: 980,
    description:
      "An ivory chantilly lace top, scalloped at every edge and fastened with two crystal brooch clasps rather than buttons, over a gold woven skirt in a songket-style geometric pattern.\n\nThe lightest piece in this collection and the most wearable afterwards: the top works on its own, and the skirt is a plain enough weave to pair with something else.",
  },
];

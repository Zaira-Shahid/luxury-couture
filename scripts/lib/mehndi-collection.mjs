/**
 * The Mehndi collection — written FROM the photographs, not matched to
 * them afterwards.
 *
 * Every file in `.mehndi/` was opened and looked at before the product
 * beside it was written, and the `saw` note records what is actually in
 * the frame. That ordering is the whole point: the earlier attempt wrote
 * products first and then hunted for pictures, which is how an emerald
 * gown ended up illustrated with a white dress.
 *
 * FIVE OF THE TWENTY-FOUR SUPPLIED IMAGES ARE NOT USED, and each is
 * listed in UNUSED below with the reason. They are not dropped silently.
 *
 * Prices sit below the bridal pieces on purpose. A mehndi outfit is worn
 * for one evening of dancing and eating, usually by the bride's family as
 * well as the bride, so the collection is priced as occasion wear
 * (£480–£1,650) rather than as bridal (£1,650–£3,200).
 */

/** Where the downloaded files live, relative to the app root. */
export const MEHNDI_IMAGE_DIR = ".mehndi";

/**
 * Images supplied but deliberately not attached to a product.
 *
 * Reported by the seeder rather than left as an unexplained gap.
 */
export const UNUSED = [
  {
    image: "m11.jpg",
    saw: "ivory and champagne gold bridal with a heavy dupatta, by a window",
    why: "a nikkah/walima look, not a mehndi one — cream-and-gold is the palette a mehndi outfit is chosen to avoid",
  },
  {
    image: "m15.jpg",
    saw: "portrait: green hijab, yellow bandhani sleeve, henna hands and bangles, reflected in a table",
    why: "the garment is barely in frame — it is a portrait, so there is nothing to sell from it",
  },
  {
    image: "m17.jpg",
    saw: "yellow saree, turmeric on the face, marigold backdrop with a painted 'গায়ে হলুদ' signboard",
    why: "the signboard is legible text belonging to someone else's ceremony; it cannot sit on a product page",
  },
  {
    image: "m19.jpg",
    saw: "ivory multicolour lehenga, but a 'Happy Janmashtami' banner fills the top of the frame",
    why: "same reason — an event banner in shot reads as someone else's photograph, not a catalogue image",
  },
  {
    image: "m20.jpg",
    saw: "peach skirt, deep pink kurti, long peach net dupatta",
    why: "a duplicate: the same photograph already illustrates Mahnoor Peach Nikkah Set in the Nikkah collection",
  },
];

/**
 * An image that belongs to a product that ALREADY exists.
 *
 * Hina Pistachio Gharara was one of the four products still carrying a
 * bulk-fetched image that did not match it. m12 is a genuine pistachio
 * outfit, so it replaces that rather than becoming a twentieth product.
 */
export const REPLACEMENTS = [
  {
    slug: "hina-pistachio-gharara",
    image: "m12.jpg",
    saw: "pale pistachio-green anarkali over a matching sharara, sheer mint dupatta, gold matha patti",
    why: "this product's colour is literally pistachio and its old image was a mismatched bulk fetch",
  },
];

export const MEHNDI_PRODUCTS = [
  {
    slug: "mahira-sunflower-mehndi-lehenga",
    name: "Mahira Sunflower Mehndi Lehenga",
    image: "m05.jpg",
    saw: "full-length sunflower-yellow lehenga with dense gold and pastel panel work, cornflower-blue embroidered blouse, dusty pink dupatta",
    occasions: ["mehndi", "engagement"],
    price: 1350,
    featured: true,
    description:
      "A sunflower-yellow skirt panelled top to hem in gold, with pale blue and pink threads worked into the motifs so the yellow does not flatten under photography lights.\n\nThe blouse is a deliberate contrast — cornflower blue rather than a matching yellow — which is what stops a mehndi lehenga reading as fancy dress. Full circle skirt, lined in cotton, cut to move when you dance.",
  },
  {
    slug: "nayab-marigold-mehndi-lehenga",
    name: "Nayab Marigold Mehndi Lehenga",
    image: "m18.jpg",
    saw: "marigold-orange lehenga with silver and black paisley work, deep maroon bandhani dupatta worn over the head, orange pom-poms, grey studio backdrop",
    occasions: ["mehndi", "baraat"],
    price: 1550,
    featured: true,
    description:
      "Marigold silk with silver paisleys and a black velvet hem, worn under a maroon bandhani dupatta. The two-colour pairing is traditional and does most of the work; the embroidery is restrained on purpose.\n\nPom-pom tassels at the waist and dupatta corners are hand-tied and can be left off if you would rather they weren't.",
  },
  {
    slug: "sahar-vermilion-mehndi-lehenga",
    name: "Sahar Vermilion Mehndi Lehenga",
    image: "m09.jpg",
    saw: "heavily worked orange, red and gold lehenga with mirror and multicolour panels, blush net dupatta, photographed outdoors in low sun",
    occasions: ["mehndi", "baraat"],
    price: 1650,
    description:
      "The heaviest piece in the collection: orange and red panels worked in gold, mirror and multicolour thread, tiered so each band reads separately from a distance.\n\nThe blush dupatta is sheer and deliberately plain — with a skirt this busy, a second worked layer turns the whole outfit to noise. This is the one to choose if you are the bride at your own mehndi.",
  },
  {
    slug: "kiran-mint-mehndi-lehenga",
    name: "Kiran Mint Mehndi Lehenga",
    image: "m22.jpg",
    saw: "mint-green lehenga with gold floral sprigs across a full spread skirt, matching peplum jacket, sheer mint dupatta, wooden doors behind",
    occasions: ["mehndi", "engagement"],
    price: 1380,
    featured: true,
    description:
      "Mint green with gold sprigs scattered rather than bordered, so the skirt fills out evenly when it spreads. The top is a fitted peplum jacket, not a cropped blouse — more covered, and easier to wear all evening.\n\nMint is the safest of the mehndi greens: it photographs cleanly under warm marquee lighting, where emerald tends to go black.",
  },
  {
    slug: "ambreen-teal-gharara",
    name: "Ambreen Teal Gharara",
    image: "m10.jpg",
    saw: "deep teal gharara with heavy gold and coral floral embroidery, gold fringe on the sleeves and hem, matching teal net dupatta over the head",
    occasions: ["mehndi", "nikkah"],
    price: 1450,
    description:
      "Deep teal with gold and coral floral work, finished with a gold fringe at the cuffs and hem. The gharara leg is cut wide from the knee and takes about four metres of fabric a side.\n\nTeal is the alternative for anyone who does not want to wear yellow or green to a mehndi but still wants colour. Heavy enough to double for a nikkah.",
  },
  {
    slug: "erum-flame-ombre-lehenga",
    name: "Erum Flame Ombré Lehenga",
    image: "m24.jpg",
    saw: "floor-length flame-orange to red ombré lehenga with a wide gold mirror-work border, long embroidered sleeves, photographed in a hotel corridor",
    occasions: ["mehndi", "reception"],
    price: 1480,
    description:
      "Orange graduating into red down the length of the skirt, dip-dyed before the border is worked so the shift is in the fabric rather than printed on it.\n\nA deep gold mirror-work border weights the hem, and the sleeves are full length and embroidered to match. Cut narrow through the hip and flared low, which is why it hangs the way it does standing still.",
  },
  {
    slug: "zunaira-fuchsia-mehndi-lehenga",
    name: "Zunaira Fuchsia Mehndi Lehenga",
    image: "m16.jpg",
    saw: "canary-yellow brocade blouse with a fuchsia-pink lehenga in dense multicolour paisley, yellow net dupatta, marigold strings behind",
    occasions: ["mehndi", "engagement"],
    price: 1290,
    description:
      "Yellow above, fuchsia below — the loudest combination here, and the one that suits a mehndi best. The skirt is worked in multicolour paisley on pink, with turquoise and gold picked out so it does not read as a single block.\n\nThe blouse is yellow brocade, structured and boned, so it holds its shape while you sit for the ceremony.",
  },
  {
    slug: "dua-burnt-orange-gharara",
    name: "Dua Burnt Orange Gharara",
    image: "m23.jpg",
    saw: "burnt-orange gharara in tiered gold gota bands, matching orange net dupatta with a gold border, side profile",
    occasions: ["mehndi", "baraat"],
    price: 1220,
    description:
      "Burnt orange banded in gold gota — flat ribbon work rather than embroidery, which is the older technique and much lighter to wear than it looks.\n\nTiered from waist to hem so the bands sit level when the gharara flares. Warmer than a true orange and considerably easier to wear if red does not suit you.",
  },
  {
    slug: "ayla-cobalt-yellow-mehndi-lehenga",
    name: "Ayla Cobalt & Yellow Mehndi Lehenga",
    image: "m02.jpg",
    saw: "cobalt-blue embroidered blouse over a bright yellow embellished skirt, rose-pink dupatta, seated outdoors",
    occasions: ["mehndi", "engagement"],
    price: 1150,
    description:
      "Cobalt blue and yellow, with a rose-pink dupatta over the top — three colours that should not work and do, which is the whole tradition of mehndi dressing.\n\nThe skirt is embellished rather than embroidered: sequin and bead work laid over yellow silk, so it catches light rather than adding weight.",
  },
  {
    slug: "iqra-canary-sharara",
    name: "Iqra Canary Sharara",
    image: "m04.jpg",
    saw: "bright canary-yellow sharara with silver embroidery and hanging tassels, photographed against a yellow haveli wall",
    occasions: ["mehndi"],
    price: 980,
    description:
      "Canary yellow with silver rather than gold embroidery — a cooler pairing that keeps a bright yellow from turning brassy.\n\nSilver tassels hang from the waist tie and the dupatta corners. The sharara is cut from the knee and gathered at the hip, which is what gives it the swing.",
  },
  {
    slug: "suhana-turmeric-bandhani-lehenga",
    name: "Suhana Turmeric Bandhani Lehenga",
    image: "m21.jpg",
    saw: "turmeric-yellow bandhani lehenga with a gold-bordered dupatta draped across the back, open-back blouse, photographed mid-turn from behind",
    occasions: ["mehndi"],
    price: 890,
    description:
      "Turmeric-yellow bandhani, tied and dyed by hand so no two skirts have quite the same grid. Gold borders at the hem and along the dupatta edge.\n\nThe blouse is cut open at the back and tied — worth knowing before you choose it. Closed and higher backs are both available at no extra cost.",
  },
  {
    slug: "roshni-gold-bandhani-saree",
    name: "Roshni Gold Bandhani Saree",
    image: "m08.jpg",
    saw: "gold-mustard bandhani saree with a woven border and matching blouse, worn seated with a floral jewellery set",
    occasions: ["mehndi"],
    price: 790,
    description:
      "Gold-mustard bandhani with a woven zari border, made up as a saree with a matching blouse. Bandhani drapes softly because the tying leaves the weave slightly crimped, which is why it falls the way it does.\n\nSupplied pre-pleated and stitched to your measurements if you would rather not drape it on the day.",
  },
  {
    slug: "sitara-mustard-bandhani-saree",
    name: "Sitara Mustard Bandhani Saree",
    image: "m06.jpg",
    saw: "mustard bandhani saree with fine white tie-dye dots and gold-threaded sleeves, worn with a jasmine and marigold garland",
    occasions: ["mehndi"],
    price: 740,
    description:
      "A finer bandhani than the Roshni — smaller dots, closer together, which takes considerably longer to tie and hangs lighter.\n\nThe sleeves are worked in gold thread and the border is kept narrow. Chosen for a mehndi where you want colour without weight, particularly in a warm room.",
  },
  {
    slug: "nashwa-bottle-green-saree",
    name: "Nashwa Bottle Green Saree",
    image: "m13.jpg",
    saw: "bottle-green silk saree with small gold buti motifs and a gold border, worn over a red and orange bandhani-print blouse",
    occasions: ["mehndi", "engagement"],
    price: 690,
    description:
      "Bottle-green silk scattered with small gold buti, bordered in gold, over a red and orange printed blouse. Green and red is the older mehndi pairing, from before yellow became the default.\n\nThe silk is heavy enough to hold a pleat without starching, which matters if you are wearing it for six hours.",
  },
  {
    slug: "zoya-chartreuse-gota-kurti",
    name: "Zoya Chartreuse Gota Kurti",
    image: "m01.jpg",
    saw: "chartreuse mehndi-green kurti with gota ribbon and mirror work, three-quarter length over a matching skirt, gold jewellery",
    occasions: ["mehndi"],
    price: 680,
    description:
      "Chartreuse — the actual colour of fresh mehndi paste, which is where the convention comes from — worked in gota ribbon and small mirrors.\n\nThree-quarter length over a matching skirt. The mirrors are stitched, not glued, so it survives being danced in and dry cleaned afterwards.",
  },
  {
    slug: "alina-amber-kurta-palazzo",
    name: "Alina Amber Kurta & Palazzo",
    image: "m07.png",
    saw: "amber-yellow sleeveless kurta densely worked in silver mirror and sequin, matching yellow palazzo, ombré pink-and-yellow dupatta, plain studio",
    occasions: ["mehndi"],
    price: 620,
    description:
      "Amber yellow worked all over in silver mirror and sequin, with a plain matching palazzo and an ombré pink-to-yellow dupatta.\n\nSleeveless as photographed; cap, short and full sleeves are all available. The simplest silhouette in the collection and the one most people actually wear again.",
  },
  {
    slug: "bushra-marigold-kurta-set",
    name: "Bushra Marigold Kurta Set",
    image: "m03.jpg",
    saw: "marigold yellow-orange kurta with gold trim, worn with a leaf-green dupatta, festive backdrop",
    occasions: ["mehndi"],
    price: 520,
    description:
      "Marigold kurta with a narrow gold trim, paired with a leaf-green dupatta — the two colours of the ceremony itself, without the outfit trying to be the centrepiece.\n\nMade for the bride's sisters and cousins rather than the bride. Priced accordingly, and it survives being ordered six at a time.",
  },
  {
    slug: "areeba-ochre-chikankari-kurta",
    name: "Areeba Ochre Chikankari Kurta",
    image: "m14.jpg",
    saw: "ochre-mustard georgette kurta in tonal chikankari whitework with a woven gold cuff band, long sleeves",
    occasions: ["mehndi"],
    price: 480,
    description:
      "Ochre georgette in tonal chikankari — the whitework technique done in matching thread instead of white, so the pattern reads as texture rather than contrast.\n\nA woven gold band at each cuff is the only hard trim on it. The lightest and least formal piece here, and the one to choose for a daytime mehndi or a dholki.",
  },
];

/**
 * Scores Pexels candidates against a product's intended colour and garment.
 *
 * WHY THIS EXISTS. The first attempt pooled ~69 results from six generic
 * queries ("bridal lehenga", "wedding embroidery", …) and assigned them
 * to products BY INDEX. That is effectively random with respect to the
 * product, and it showed: an emerald gown got a white dress, an ivory
 * lehenga got a lavender one, and a blush anarkali got a photograph of
 * jewellery with no garment in it at all.
 *
 * WHAT THIS CAN AND CANNOT DO — stated plainly, because the request was
 * to "verify each image visually" and I cannot see images.
 *
 *   CAN: search per product using that product's own colour and garment;
 *        reject candidates whose description is about accessories rather
 *        than clothing; rank what remains by how close the photograph's
 *        average colour sits to the product's intended colour.
 *
 *   CANNOT: confirm the garment in the frame is the right shape, or that
 *        the dominant colour belongs to the dress rather than the
 *        backdrop. `avg_color` is the mean of the WHOLE image — skin,
 *        background and jewellery included — so a green dress shot
 *        against warm marble can average brown.
 *
 * The score is therefore a strong filter, not a guarantee. Every choice
 * is printed with its colour distance so a human can spot a bad one, and
 * `--report` lists them all without touching the database.
 */

/** #RRGGBB -> {r,g,b}. Returns null for anything unparseable. */
export function parseHex(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

/** sRGB -> CIE Lab, so distances mean something perceptually. */
function toLab({ r, g, b }) {
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];

  // sRGB D65 -> XYZ
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/**
 * Perceptual distance between two hex colours (CIE76).
 *
 * Roughly: under ~25 is a close match, ~50 is the same family, over ~80
 * is a different colour altogether.
 */
export function colourDistance(hexA, hexB) {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  if (!a || !b) return Infinity;
  const la = toLab(a);
  const lb = toLab(b);
  return Math.sqrt((la.L - lb.L) ** 2 + (la.a - lb.a) ** 2 + (la.b - lb.b) ** 2);
}

/**
 * Words that mean a garment is the subject.
 *
 * Pexels alt text is generated and verbose, but it reliably names what is
 * in the frame, which is enough to tell a dress from a close-up of
 * bangles.
 */
const GARMENT_WORDS = [
  "lehenga", "saree", "sari", "dress", "gown", "attire", "outfit", "anarkali",
  "sharara", "gharara", "kurta", "kurti", "bride", "bridal", "clothing",
  "traditional", "wearing", "costume", "fashion", "model", "woman", "girl",
];

/**
 * Words that mean the frame is about something OTHER than the clothes.
 *
 * This is the filter that fixes the blush anarkali getting a photograph
 * of jewellery: that image came from an "indian wedding jewellery" query
 * and its description says so.
 */
const NON_GARMENT_WORDS = [
  "jewelry", "jewellery", "necklace", "earring", "bangle", "bracelet", "ring ",
  "henna", "mehndi design", "close-up of hand", "closeup of hand", "hands",
  "food", "flower", "decoration", "invitation", "cake", "ceremony table",
  "shoes", "footwear", "makeup", "cosmetic",
];

function countMatches(text, words) {
  const lower = (text ?? "").toLowerCase();
  return words.filter((word) => lower.includes(word)).length;
}

/**
 * Scores one candidate. Lower is better; Infinity means rejected.
 */
export function scoreCandidate(photo, targetHex) {
  const alt = photo.alt ?? "";
  const garment = countMatches(alt, GARMENT_WORDS);
  const nonGarment = countMatches(alt, NON_GARMENT_WORDS);

  // Reject outright when the description is clearly about accessories and
  // says nothing about clothing. A photograph of a necklace is never the
  // right image for a dress, however well its colour happens to match.
  if (nonGarment > 0 && garment === 0) {
    return { score: Infinity, distance: Infinity, reason: "accessories, no garment" };
  }

  const distance = colourDistance(photo.avgColor, targetHex);

  // Colour dominates; the garment-word count breaks ties in favour of
  // images whose description is more clearly about clothing.
  const score = distance - Math.min(garment, 4) * 4;

  return { score, distance, reason: null };
}

/** Picks the best candidate, or null when every one was rejected. */
export function pickBest(photos, targetHex, alreadyUsed = new Set()) {
  const scored = photos
    .filter((photo) => !alreadyUsed.has(photo.id))
    .map((photo) => ({ photo, ...scoreCandidate(photo, targetHex) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => a.score - b.score);

  return scored[0] ?? null;
}

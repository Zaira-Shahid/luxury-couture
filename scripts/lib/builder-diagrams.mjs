/**
 * Line diagrams for the builder's neckline, sleeve and dupatta options.
 *
 * WHY DRAWN RATHER THAN PHOTOGRAPHED.
 *
 * A "sweetheart" and a "V-neck" differ by one curve, and stock libraries
 * do not label that difference reliably — searching either term returns
 * the other about as often as not. Fabric and embroidery are the
 * opposite: the texture IS the subject, so a photograph is both findable
 * and honest. So the two groups are sourced differently on purpose.
 *
 * These are correct BY CONSTRUCTION. There is no matching step to get
 * wrong, they weigh a couple of KB each, and they render identically at
 * any size.
 *
 * Palette is taken from the storefront: warm off-white ground, ink line.
 */

const GROUND = "#F7F4EF";
const INK = "#2A2622";
const SOFT = "#C9BFB2";
const SIZE = 600;

function frame(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="${GROUND}"/>
  <g fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
${inner}
  </g>
</svg>`;
}

/**
 * The shared bodice: shoulders, sides and hem. `neck` is the path across
 * the top that each neckline replaces, so every tile shows the same
 * garment differing only in the feature being chosen.
 */
function bodice(neck, extra = "") {
  return `    <path d="M190 165 L150 205 L150 470 L450 470 L450 205 L410 165"/>
${neck}
${extra}`;
}

export const NECKLINES = {
  sweetheart: bodice(
    `    <path d="M190 165 C 205 245, 265 265, 300 215 C 335 265, 395 245, 410 165"/>`
  ),
  "boat-neck": bodice(`    <path d="M190 165 C 250 205, 350 205, 410 165"/>`),
  "v-neck": bodice(`    <path d="M190 165 L300 320 L410 165"/>`),
  "high-neck": bodice(
    `    <path d="M235 168 L235 120 C 235 100, 365 100, 365 120 L365 168"/>
    <path d="M190 165 C 205 178, 220 168, 235 168"/>
    <path d="M410 165 C 395 178, 380 168, 365 168"/>`
  ),
};

/**
 * Sleeves are drawn as ONE closed silhouette of the whole garment rather
 * than a bodice with strips added beside it.
 *
 * The first version layered separate sleeve paths next to a torso, and it
 * showed: the full sleeves read as two detached ribbons and the cap
 * sleeves as small ears stuck on the shoulders. Tracing a single outline
 * — neck, shoulder, down the outer arm, across the cuff, back up to the
 * armpit, down the side seam, along the hem — makes the sleeve part of
 * the garment, which is the whole thing being chosen here.
 *
 * Only the cuff height changes between the four; everything else is
 * shared, so the tiles differ by exactly the property they name.
 */
function sleeveSilhouette(cuff) {
  const neck = "M215 175 C 250 208, 350 208, 385 175";
  if (!cuff) {
    // Sleeveless: the shoulder runs straight into the armhole, so the
    // absence is drawn rather than implied by a missing piece.
    return `    <path d="${neck} L445 205 L400 258 L415 470 L185 470 L200 258 L155 205 Z"/>`;
  }
  const { y, outer, inner } = cuff;
  const ro = 600 - outer;
  const ri = 600 - inner;
  return `    <path d="${neck} L445 205 L${ro} ${y} L${ri} ${y + 10} L400 258 L415 470 L185 470 L200 258 L${inner} ${y + 10} L${outer} ${y} L155 205 Z"/>`;
}

export const SLEEVES = {
  "full-sleeves": sleeveSilhouette({ y: 415, outer: 108, inner: 168 }),
  "half-sleeves": sleeveSilhouette({ y: 312, outer: 120, inner: 174 }),
  "cap-sleeves": sleeveSilhouette({ y: 250, outer: 134, inner: 180 }),
  sleeveless: sleeveSilhouette(null),
};

/**
 * Dupattas are drawn as the drape itself rather than on a body: it is the
 * fabric being chosen, not how it is worn. Net is dashed to read as
 * sheer, embroidered carries a bordered edge with motifs, plain silk is a
 * solid drape. "No dupatta" is the drape struck through — an empty tile
 * would look like a missing image rather than a deliberate choice.
 */
function drape(strokeAttrs = "", extra = "") {
  return `    <path d="M120 130 C 240 90, 360 90, 480 130 C 455 300, 470 420, 480 500 C 360 460, 240 460, 120 500 C 130 420, 145 300, 120 130 Z"${strokeAttrs}/>
${extra}`;
}

export const DUPATTAS = {
  "net-dupatta": drape(
    ` stroke-dasharray="16 14"`,
    `    <path d="M180 200 C 300 170, 380 190, 440 215" stroke="${SOFT}" stroke-dasharray="10 12"/>
    <path d="M165 320 C 290 290, 380 310, 445 330" stroke="${SOFT}" stroke-dasharray="10 12"/>`
  ),
  "embroidered-dupatta": drape(
    "",
    `    <path d="M143 175 C 250 143, 355 143, 462 175" stroke="${SOFT}"/>
    <path d="M143 455 C 250 425, 355 425, 462 455" stroke="${SOFT}"/>
    <circle cx="230" cy="280" r="17" stroke="${SOFT}"/>
    <circle cx="300" cy="330" r="17" stroke="${SOFT}"/>
    <circle cx="370" cy="280" r="17" stroke="${SOFT}"/>`
  ),
  "plain-silk-dupatta": drape(
    "",
    `    <path d="M215 175 C 250 300, 250 390, 230 480" stroke="${SOFT}"/>
    <path d="M385 175 C 350 300, 350 390, 370 480" stroke="${SOFT}"/>`
  ),
  "no-dupatta": drape(
    ` stroke="${SOFT}"`,
    `    <path d="M165 165 L435 465"/>`
  ),
};

/** slug -> SVG string, across all three groups. */
export const DIAGRAMS = {
  necklines: Object.fromEntries(Object.entries(NECKLINES).map(([k, v]) => [k, frame(v)])),
  sleeve_styles: Object.fromEntries(Object.entries(SLEEVES).map(([k, v]) => [k, frame(v)])),
  dupatta_options: Object.fromEntries(Object.entries(DUPATTAS).map(([k, v]) => [k, frame(v)])),
};

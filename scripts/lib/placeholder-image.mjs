import { deflateSync } from "node:zlib";

/**
 * Generates PNG placeholder images with no dependencies.
 *
 * WHY NOT UNSPLASH / PICSUM. Two of this project's own decisions rule out
 * every external placeholder service:
 *
 *   * Module 28 set next.config.mjs `remotePatterns` to the Supabase host
 *     only, so next/image THROWS on any other host — taking the page
 *     down, not just the image.
 *   * Module 29 shipped a CSP with `img-src 'self' data: blob:
 *     https://<supabase>`, so an external image is blocked outright.
 *
 * An external placeholder would therefore break the storefront twice
 * over. Generating images locally and uploading them to Supabase Storage
 * satisfies both, and sidesteps the licensing question the Master Build
 * Plan raises ("do not use copyrighted brand assets") completely: nothing
 * here is derived from anyone's work.
 *
 * WHY NOT SVG, which would be far less code: `validate-file.ts` rejects
 * SVG deliberately as a stored-XSS vector, and next/image refuses to
 * optimise it without `dangerouslyAllowSVG`. Relaxing either for the sake
 * of demo data would be a bad trade.
 *
 * A 1200x1500 gradient comes out around 8 kB, so a dozen products cost
 * about 100 kB of storage.
 */

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/**
 * Deterministic 32-bit hash. The same slug always produces the same
 * image, so re-running the seeder does not silently reshuffle the whole
 * catalogue's artwork.
 */
function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * The brand's own palette — warm ivory, deep ink, antique gold, taken
 * from globals.css. Placeholders that clash with the site look like a
 * mistake; ones drawn from its palette look like a considered choice.
 */
const PALETTE = [
  [212, 185, 140], // antique gold
  [158, 122, 108], // rosewood
  [122, 134, 130], // sage
  [138, 116, 148], // plum
  [180, 154, 128], // sand
  [104, 116, 140], // slate blue
];

/**
 * A vertical two-tone gradient with a subtle horizontal wash.
 *
 * Not a solid colour: a flat rectangle reads as a broken image, while a
 * gradient reads as a deliberate placeholder. There is no text — drawing
 * glyphs without a font library would be a great deal of code for very
 * little, and an unlabelled colour study is honest about being a
 * stand-in.
 */
export function generatePlaceholderPng(seed, width = 1200, height = 1500) {
  const hash = hashString(seed);
  const base = PALETTE[hash % PALETTE.length];
  const accent = PALETTE[(hash >>> 8) % PALETTE.length];

  const raw = Buffer.alloc(height * (width * 3 + 1));
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // PNG filter type 0 (None) for this scanline.
    offset += 1;
    const vertical = y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      // A gentle horizontal component keeps it from looking like a
      // banding artefact.
      const horizontal = (x / (width - 1)) * 0.25;
      const t = Math.min(1, vertical * 0.85 + horizontal);
      raw[offset] = Math.round(base[0] + (accent[0] - base[0]) * t);
      raw[offset + 1] = Math.round(base[1] + (accent[1] - base[1]) * t);
      raw[offset + 2] = Math.round(base[2] + (accent[2] - base[2]) * t);
      offset += 3;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** True when `buffer` starts with the PNG signature. */
export function isPng(buffer) {
  return buffer.length > 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}

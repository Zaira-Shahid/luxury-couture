/**
 * Sources real photography for the demo store from the Pexels API.
 *
 * WHY PEXELS AND NOT UNSPLASH. Unsplash was asked for first, but its API
 * returns 401 without a registered application's Access Key, and the old
 * keyless `source.unsplash.com` endpoint is retired (503). The owner
 * supplied a Pexels key instead. Both licences permit commercial use; the
 * practical difference here is only which one we have credentials for.
 *
 * THE KEY LIVES IN .env.local AND IS NEVER COMMITTED. Read from the
 * environment, never inlined — .gitignore covers .env.local, and this
 * file must stay safe to commit.
 *
 * LICENCE POSITION, stated rather than assumed. The Pexels licence allows
 * free use including commercially, with no attribution required. It does
 * NOT grant model or property releases: photographs of identifiable
 * people may not be used to imply endorsement of a product. That is fine
 * for demo data standing in for a catalogue, and it is a real
 * consideration before these become the imagery of a live shop selling
 * garments that are not the ones photographed. The photographer's name is
 * recorded on every uploaded row so attribution is possible even though
 * it is not required.
 *
 * DOWNLOADS ARE VALIDATED, not trusted. Anything fetched from the network
 * is checked for a real image signature and a sane size before it goes
 * anywhere near storage.
 */

const PEXELS_ENDPOINT = "https://api.pexels.com/v1/search";

/** JPEG and PNG magic numbers. */
function detectImageType(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return "image/png";
  return null;
}

/**
 * Searches Pexels and returns candidate photos.
 *
 * `orientation=portrait` because these are garment shots that render in
 * a 1200x1500 frame; landscape crops would letterbox badly.
 */
export async function searchPhotos(query, { perPage = 15, orientation = "portrait" } = {}) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("PEXELS_API_KEY is not set — add it to .env.local");

  const url = `${PEXELS_ENDPOINT}?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orientation}`;
  const res = await fetch(url, { headers: { Authorization: key } });

  if (res.status === 429) {
    throw new Error("Pexels rate limit reached (free tier is 200/hour, 20k/month)");
  }
  if (!res.ok) {
    throw new Error(`Pexels search failed: ${res.status} ${await res.text().catch(() => "")}`);
  }

  const body = await res.json();
  return (body.photos ?? []).map((photo) => ({
    id: photo.id,
    photographer: photo.photographer,
    photographerUrl: photo.photographer_url,
    pageUrl: photo.url,
    alt: photo.alt || null,
    // `large` is ~940px on the long edge and a few hundred kB. `original`
    // can be 20MB+, which would blow past the media bucket's 10MB limit
    // and waste storage on images rendered at 1200px.
    downloadUrl: photo.src?.large2x ?? photo.src?.large,
  }));
}

/**
 * Downloads one photo and returns a validated buffer.
 *
 * Rejects anything that is not actually a JPEG or PNG, and anything over
 * the media bucket's limit — a bad download must fail here rather than at
 * the storage API, where the error is less clear.
 */
export async function downloadPhoto(photo, maxBytes = 10 * 1024 * 1024) {
  const res = await fetch(photo.downloadUrl);
  if (!res.ok) throw new Error(`download failed for ${photo.id}: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = detectImageType(buffer);

  if (!contentType) {
    throw new Error(`photo ${photo.id} is not a JPEG or PNG (got ${buffer.length} bytes)`);
  }
  if (buffer.length > maxBytes) {
    throw new Error(`photo ${photo.id} is ${buffer.length} bytes, over the ${maxBytes} limit`);
  }
  if (buffer.length < 5000) {
    throw new Error(`photo ${photo.id} is suspiciously small (${buffer.length} bytes)`);
  }

  return { buffer, contentType };
}

/**
 * The searches used for the demo catalogue.
 *
 * Several narrow queries rather than one broad one: "bridal lehenga"
 * alone returns visually similar results, and a catalogue where every
 * product looks like the same photograph is worse for judging layout than
 * obvious placeholders were.
 */
export const DEMO_PHOTO_QUERIES = [
  "bridal lehenga",
  "south asian wedding dress",
  "indian bridal fashion",
  "wedding embroidery",
  "indian wedding jewellery",
  "traditional indian clothing",
];

/**
 * Owner-supplied photographs, mapped to products BY EYE.
 *
 * Every file below was opened and looked at before being assigned — this
 * is not a filename guess. The `saw` note records what the image actually
 * shows, so a later reader can tell whether the match still holds without
 * reopening nineteen files.
 *
 * Products absent from this map are sourced from Pexels instead, because
 * the uploads did not contain that colour.
 */
export const LOCAL_PHOTO_MAP = {
  "amrita-crimson-bridal-lehenga": {
    file: "pexels-altinduvakmoda-18930979.jpg",
    saw: "deep crimson velvet lehenga, heavy gold zardozi, full length studio",
    matches: "crimson + gold zardozi, exactly as described",
  },
  "noor-ivory-gold-lehenga": {
    file: "pexels-skgphotography-29351979.jpg",
    saw: "ivory/cream net dupatta with gold work over a plum-toned lehenga",
    matches: "ivory and antique gold — the closest ivory in the uploads",
  },
  "sana-rose-mehndi-set": {
    file: "pexels-abirjoy999-15978609.jpg",
    saw: "dusty rose lehenga with silver/crystal work, full length with train",
    matches: "dusty rose, exactly the colour named in the description",
  },
  "zara-emerald-reception-gown": {
    file: "pexels-ally-darous-547915538-35743810.jpg",
    saw: "emerald green velvet with gold floral embroidery, bride with mehndi",
    matches: "emerald green — the only true emerald in the uploads",
  },
  "aisha-midnight-sharara": {
    file: "pexels-altinduvakmoda-18860925.jpg",
    saw: "midnight navy velvet, gold paisley embroidery, sheer dupatta, full length",
    matches: "midnight blue, and the sheer dupatta the copy mentions",
  },
  "layla-saffron-sharara": {
    file: "pexels-mysara-hassan-116278479-27024449.jpg",
    saw: "saffron/copper silk with dense gold embroidery, mehndi hands, detail crop",
    matches: "saffron with gold trim, warm evening light as described",
  },
  "nadia-charcoal-kurta-set": {
    file: "pexels-altinduvakmoda-18860781.jpg",
    saw: "black/charcoal lehenga with gold embroidery, full length studio",
    matches: "charcoal — the darkest neutral in the uploads",
  },
};

/** Where the owner's files live. Overridable for a different machine. */
export const LOCAL_PHOTO_DIR =
  process.env.DEMO_PHOTO_DIR ?? "C:/Users/Fast Computers/Downloads";

/**
 * Turns a customer's free-text question into a STRUCTURED intent, which
 * then drives ordinary SQL against real rows.
 *
 * This is the central design decision of Module 23: **the AI never writes
 * the product list, it only parses the question into filters.** The
 * customer sees product cards loaded from the database, never prose
 * describing products that may not exist. That is what the Master Build
 * Plan means by "AI responses must be clearly constrained by business
 * data", enforced by architecture rather than by prompt wording.
 *
 * Deliberately import-free, like guardrails.ts and faq-matching.ts, so
 * scripts/test-chatbot.mjs can import it directly under Node's type
 * stripping and test it exhaustively rather than only through HTTP.
 *
 * The vocabulary is passed IN, never hardcoded: callers supply the real
 * colour/fabric/occasion/category names from the database. A term that
 * does not exist in the catalogue therefore cannot be matched, which is
 * why an unrecognised query yields an EMPTY intent rather than a wrong
 * one — the assistant then says it isn't sure instead of guessing.
 */

export type QueryVocabulary = {
  occasions: { slug: string; name: string }[];
  colours: { slug: string; name: string }[];
  fabrics: { slug: string; name: string }[];
  categories: { slug: string; name: string }[];
};

export type QueryIntent = {
  occasionSlug: string | null;
  colourNames: string[];
  fabricNames: string[];
  categorySlug: string | null;
  /** Leftover words worth matching against product name/description. */
  freeText: string;
  /** True when nothing at all was recognised. */
  isEmpty: boolean;
};

export const EMPTY_INTENT: QueryIntent = {
  occasionSlug: null,
  colourNames: [],
  fabricNames: [],
  categorySlug: null,
  freeText: "",
  isEmpty: true,
};

/**
 * Common ways customers name an occasion that differ from the stored
 * name. Kept small and additive: the database is still the source of
 * truth, these only widen how a real occasion can be referred to.
 */
const OCCASION_SYNONYMS: Record<string, string[]> = {
  bridal: ["bride", "brides", "wedding", "shaadi", "nikah", "dulhan"],
  mehndi: ["mehendi", "mehandi", "henna", "sangeet"],
  walima: ["waleema", "valima"],
  reception: ["receptions"],
  engagement: ["engaged", "mangni", "mangani"],
  party: ["parties", "event", "events", "festive"],
};

const STOPWORDS = new Set([
  "a","an","the","is","are","am","was","were","be","do","does","did","i","you","we","they","it",
  "me","my","your","our","of","to","in","on","at","for","with","from","by","about","as","and","or",
  "but","if","then","can","could","will","would","should","have","has","had","get","got","show",
  "find","looking","look","want","need","like","some","something","anything","please","hi","hello",
  "what","when","where","which","who","why","how","there","here","that","this","give","suggest",
  "recommend","help","me","wear","wearing","outfit","lehenga","lehengas","dress","piece","pieces",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Matches a multi-word name as a whole phrase ("emerald green"), which a
 * naive token loop would miss.
 */
function containsPhrase(haystack: string, phrase: string): boolean {
  const needle = normalize(phrase);
  if (!needle) return false;
  return new RegExp(`(^|\\s)${needle.replace(/\s+/g, "\\s+")}($|\\s)`).test(haystack);
}

export function parseQueryIntent(query: string, vocabulary: QueryVocabulary): QueryIntent {
  const text = normalize(query);
  if (!text) return { ...EMPTY_INTENT };

  const matched = new Set<string>();

  // Occasion: stored name, slug, or a known synonym.
  let occasionSlug: string | null = null;
  for (const occasion of vocabulary.occasions) {
    const candidates = [
      occasion.name,
      occasion.slug.replace(/-/g, " "),
      ...(OCCASION_SYNONYMS[occasion.slug] ?? []),
    ];
    const hit = candidates.find((candidate) => containsPhrase(text, candidate));
    if (hit) {
      occasionSlug = occasion.slug;
      matched.add(normalize(hit));
      break;
    }
  }

  const colourNames: string[] = [];
  for (const colour of vocabulary.colours) {
    if (containsPhrase(text, colour.name) || containsPhrase(text, colour.slug.replace(/-/g, " "))) {
      colourNames.push(colour.name);
      matched.add(normalize(colour.name));
    }
  }

  const fabricNames: string[] = [];
  for (const fabric of vocabulary.fabrics) {
    if (containsPhrase(text, fabric.name) || containsPhrase(text, fabric.slug.replace(/-/g, " "))) {
      fabricNames.push(fabric.name);
      matched.add(normalize(fabric.name));
    }
  }

  let categorySlug: string | null = null;
  for (const category of vocabulary.categories) {
    if (
      containsPhrase(text, category.name) ||
      containsPhrase(text, category.slug.replace(/-/g, " "))
    ) {
      categorySlug = category.slug;
      matched.add(normalize(category.name));
      break;
    }
  }

  // Whatever is left after removing recognised terms and stopwords is
  // worth trying against product name/description.
  let remaining = text;
  for (const term of matched) {
    remaining = remaining.replace(new RegExp(term.replace(/\s+/g, "\\s+"), "g"), " ");
  }
  const freeText = remaining
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
    .join(" ")
    .trim();

  const isEmpty =
    !occasionSlug &&
    colourNames.length === 0 &&
    fabricNames.length === 0 &&
    !categorySlug &&
    freeText.length === 0;

  return { occasionSlug, colourNames, fabricNames, categorySlug, freeText, isEmpty };
}

/**
 * Cheap classifier deciding whether a message is a product-discovery
 * request or a question for the FAQ engine. Runs before any provider
 * call, so an obvious "do you ship to France" never costs an API request.
 */
export function looksLikeDiscovery(query: string, intent: QueryIntent): boolean {
  const text = normalize(query);

  // A recognised catalogue term is the strongest signal, and it wins even
  // inside a question form — "do you have anything emerald?" is discovery,
  // not an FAQ lookup.
  const hasCatalogueTerm =
    Boolean(intent.occasionSlug) ||
    intent.colourNames.length > 0 ||
    intent.fabricNames.length > 0 ||
    Boolean(intent.categorySlug);
  if (hasCatalogueTerm) return true;

  // Otherwise fall back to how the message is phrased.
  return /\b(show|find|looking for|browse|see|suggest|recommend|ideas?)\b/.test(text);
}

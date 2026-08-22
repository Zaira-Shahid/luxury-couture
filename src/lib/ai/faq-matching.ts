/**
 * The deterministic FAQ matching algorithm, kept as a pure function with
 * no imports so it can be unit-tested directly (see scripts/test-ai.mjs)
 * rather than only through a rendered page. The provider supplies the
 * FAQs; this decides which one answers a question, or that none does.
 *
 * Token overlap, not semantics. A question worded entirely differently
 * from every FAQ will miss and correctly return no match — semantic
 * matching needs embeddings, which is a paid dependency this module
 * deliberately avoids. The expensive failure mode here is a confident
 * wrong answer, not a miss, so the threshold is set to prefer misses.
 */

/** Words carrying no discriminating signal. */
const STOPWORDS = new Set([
  "a","an","the","is","are","am","was","were","be","been","being","do","does","did","doing",
  "i","you","we","they","he","she","it","me","my","your","our","their","this","that","these","those",
  "of","to","in","on","at","for","with","from","by","about","as","into","and","or","but","if","then",
  "can","could","will","would","shall","should","may","might","must","have","has","had","get","got",
  "what","when","where","which","who","whom","why","how","there","here","please","tell","know","need",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

/**
 * Below this we say we don't know. Tuned so a question sharing one
 * incidental word with a FAQ cannot produce a confident answer.
 */
export const CONFIDENCE_THRESHOLD = 0.34;

/** A FAQ answer body contributes to matching, but at a discount — a FAQ is identified by what it asks. */
const ANSWER_TOKEN_WEIGHT = 0.4;

export type MatchableFaq = { id: string; question: string; answer: string };

export type FaqMatch = { faqId: string; answer: string; confidence: number } | null;

/**
 * Returns the best FAQ above the confidence threshold, or null.
 *
 * Scores are normalised by the *question's* token count, so a long FAQ
 * answer cannot win by sheer length — otherwise the wordiest FAQ would
 * match everything.
 */
export function matchFaq(question: string, faqs: MatchableFaq[]): FaqMatch {
  const questionTokens = tokenize(question);
  if (questionTokens.length === 0 || faqs.length === 0) return null;

  let best: { faqId: string; answer: string; confidence: number } | null = null;

  for (const faq of faqs) {
    const faqTokens = new Set(tokenize(faq.question));
    const answerTokens = new Set(tokenize(faq.answer));

    let score = 0;
    for (const token of questionTokens) {
      if (faqTokens.has(token)) score += 1;
      else if (answerTokens.has(token)) score += ANSWER_TOKEN_WEIGHT;
    }

    const confidence = Math.min(score / questionTokens.length, 1);
    if (!best || confidence > best.confidence) {
      best = { faqId: faq.id, answer: faq.answer, confidence };
    }
  }

  if (!best || best.confidence < CONFIDENCE_THRESHOLD) return null;
  return best;
}

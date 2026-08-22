import { cache } from "react";

import { getActiveFaqs } from "@/lib/content/get-content";
import { getActiveCategories } from "@/lib/catalog/get-categories";
import { siteConfig } from "@/lib/config/site";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

/**
 * Assembles the ONLY context any AI provider is ever given.
 *
 * This is the "safe knowledge source" the Master Build Plan requires. The
 * allow-list is the point: rather than passing whatever a caller happens
 * to have, every provider takes its context from here, so what the model
 * can possibly know is one short, auditable list.
 *
 * Deliberately excluded, and it must stay that way:
 *  - any customer PII (names, emails, addresses, measurements)
 *  - any order, payment, quotation or production record
 *  - prices of any kind — see guardrails.ts on why AI never quotes money
 *  - anything from a draft/unpublished row
 *
 * `faqs` is admin-curated (Module 20) and is the primary answer source:
 * the deterministic provider only ever returns text an admin wrote.
 */

export type AiKnowledge = {
  brandName: string;
  brandDescription: string;
  faqs: { id: string; question: string; answer: string; category: string | null }[];
  categoryNames: string[];
  contactEmail: string | null;
};

export const getAiKnowledge = cache(async (): Promise<AiKnowledge> => {
  const [settings, faqs, categories] = await Promise.all([
    getSiteSettings(),
    getActiveFaqs(),
    getActiveCategories(),
  ]);

  return {
    brandName: settings.seo.defaultTitle ?? siteConfig.name,
    brandDescription: settings.seo.defaultDescription ?? siteConfig.description,
    faqs: faqs.map((faq) => ({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
    })),
    categoryNames: categories.map((category) => category.name),
    contactEmail: settings.store.contactEmail,
  };
});

/** Shown whenever no confident answer exists. Never a guess. */
export function buildFallbackMessage(contactEmail: string | null): string {
  return contactEmail
    ? `I don't have a confident answer for that. Please email ${contactEmail} or use the contact form and our team will help.`
    : "I don't have a confident answer for that. Please use the contact form and our team will help.";
}

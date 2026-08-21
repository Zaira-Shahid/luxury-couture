import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { getActiveFaqs } from "@/lib/content/get-content";
import { buildMetadata } from "@/lib/seo/build-metadata";
import { faqSchema } from "@/lib/seo/structured-data";
import type { Faq } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Frequently Asked Questions",
    description:
      "Answers about custom orders, measurements, fittings, delivery times, payment and alterations.",
    path: "/faq",
  });
}

/** Groups by category, keeping DB sort_order within each group. */
function groupByCategory(faqs: Faq[]) {
  const groups = new Map<string, Faq[]>();
  for (const faq of faqs) {
    const key = faq.category?.trim() || "General";
    const existing = groups.get(key);
    if (existing) existing.push(faq);
    else groups.set(key, [faq]);
  }
  return [...groups.entries()];
}

export default async function FaqPage() {
  const faqs = await getActiveFaqs();
  const groups = groupByCategory(faqs);

  return (
    <div className="container max-w-3xl py-16">
      {/* Only emitted when real FAQs exist — an empty FAQPage is an
          invalid rich result. */}
      {faqs.length > 0 ? (
        <JsonLd
          data={faqSchema(faqs.map((faq) => ({ question: faq.question, answer: faq.answer })))}
        />
      ) : null}
      <Breadcrumbs
        className="mb-8"
        items={[
          { name: "Home", path: "/" },
          { name: "FAQ", path: "/faq" },
        ]}
      />

      <h1 className="font-heading text-4xl">Frequently Asked Questions</h1>

      {faqs.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          No questions published yet — please{" "}
          <Link href="/contact" className="underline hover:text-foreground">
            get in touch
          </Link>{" "}
          and we&apos;ll help directly.
        </p>
      ) : (
        <div className="mt-10 flex flex-col gap-10">
          {groups.map(([category, items]) => (
            <section key={category}>
              <h2 className="font-heading text-2xl">{category}</h2>
              <dl className="mt-4 flex flex-col divide-y divide-border border-y border-border">
                {items.map((faq) => (
                  <div key={faq.id} className="py-4">
                    <dt className="font-medium text-foreground">{faq.question}</dt>
                    <dd className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

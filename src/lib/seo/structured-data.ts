import { absoluteAssetUrl, absoluteUrl } from "./urls";

/**
 * Pure schema.org JSON-LD builders — plain data in, plain object out. No
 * React and no database access, so pages stay in control of what they
 * fetch and these stay trivially testable.
 *
 * Every builder emits absolute URLs (Google rejects relative ones) and
 * omits fields it has no real value for rather than emitting nulls —
 * inventing data here would be lying to search engines.
 */

type JsonLdObject = Record<string, unknown>;

/** Drops keys whose value is null/undefined/empty so no blank fields ship. */
function compact(obj: JsonLdObject): JsonLdObject {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== "")
  );
}

export function organizationSchema(input: {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  socialUrls?: string[];
}): JsonLdObject {
  return compact({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: absoluteUrl("/"),
    description: input.description ?? undefined,
    logo: absoluteAssetUrl(input.logoUrl) ?? undefined,
    email: input.email ?? undefined,
    telephone: input.phone ?? undefined,
    address: input.address ? { "@type": "PostalAddress", streetAddress: input.address } : undefined,
    sameAs: input.socialUrls?.length ? input.socialUrls : undefined,
  });
}

export function websiteSchema(input: { name: string; description?: string | null }): JsonLdObject {
  return compact({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    url: absoluteUrl("/"),
    description: input.description ?? undefined,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/products")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  });
}

export function productSchema(input: {
  name: string;
  description?: string | null;
  path: string;
  sku?: string | null;
  images: string[];
  price: number;
  currency: string;
  inStock?: boolean;
  brandName: string;
  rating?: { average: number; count: number } | null;
}): JsonLdObject {
  const url = absoluteUrl(input.path);
  const images = input.images
    .map((img) => absoluteAssetUrl(img))
    .filter((img): img is string => Boolean(img));

  return compact({
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description ?? undefined,
    sku: input.sku ?? undefined,
    image: images.length ? images : undefined,
    brand: { "@type": "Brand", name: input.brandName },
    offers: {
      "@type": "Offer",
      url,
      price: input.price.toFixed(2),
      priceCurrency: input.currency,
      availability:
        input.inStock === false
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
    },
    // Only emitted when real reviews exist — Google penalises empty or
    // fabricated aggregate ratings.
    aggregateRating:
      input.rating && input.rating.count > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: input.rating.average.toFixed(1),
            reviewCount: input.rating.count,
          }
        : undefined,
  });
}

export type BreadcrumbItem = { name: string; path: string };

export function breadcrumbSchema(items: BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqSchema(items: { question: string; answer: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function blogPostingSchema(input: {
  title: string;
  description?: string | null;
  path: string;
  imageUrl?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  authorName?: string | null;
  publisherName: string;
}): JsonLdObject {
  return compact({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description ?? undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(input.path) },
    image: absoluteAssetUrl(input.imageUrl) ?? undefined,
    datePublished: input.publishedAt ?? undefined,
    dateModified: input.updatedAt ?? input.publishedAt ?? undefined,
    author: input.authorName
      ? { "@type": "Person", name: input.authorName }
      : { "@type": "Organization", name: input.publisherName },
    publisher: { "@type": "Organization", name: input.publisherName },
  });
}

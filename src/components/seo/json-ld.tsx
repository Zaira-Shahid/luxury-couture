/**
 * Emits a schema.org JSON-LD block. Build the object with a helper from
 * `@/lib/seo/structured-data` and hand it here.
 *
 * The `<` escape matters: JSON-LD is injected as raw script content, so a
 * product name or review containing "</script>" would otherwise break out
 * of the tag. Escaping `<` to its unicode form keeps the JSON valid and
 * the markup inert.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

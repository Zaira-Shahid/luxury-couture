import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema, type BreadcrumbItem } from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

/**
 * Visible breadcrumb trail that also emits `BreadcrumbList` JSON-LD, so
 * one component covers both the internal-linking and the structured-data
 * requirements of Module 20.
 *
 * Pass the full trail including Home and the current page. The last item
 * renders as plain text (you don't link to the page you're on) but still
 * appears in the schema, which Google expects.
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <>
      <JsonLd data={breadcrumbSchema(items)} />
      <nav aria-label="Breadcrumb" className={cn("text-sm text-muted-foreground", className)}>
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={`${item.path}-${index}`} className="flex items-center gap-1.5">
                {isLast ? (
                  <span aria-current="page" className="text-foreground">
                    {item.name}
                  </span>
                ) : (
                  <>
                    <Link href={item.path} className="transition-colors hover:text-foreground">
                      {item.name}
                    </Link>
                    <ChevronRight aria-hidden className="size-3.5 shrink-0" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

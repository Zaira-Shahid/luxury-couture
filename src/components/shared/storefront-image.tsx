import Image from "next/image";

/**
 * Image wrapper for public storefront surfaces.
 *
 * `next/image` gives us resizing, modern formats and lazy loading — but it
 * throws a runtime error (breaking the whole page) if the host isn't in
 * `next.config.mjs`'s `remotePatterns`. Catalog and media-library images
 * are Supabase Storage URLs and always safe; but several admin fields
 * (blog cover image, share images, banner links) are free-text, so an
 * admin can paste any URL at all.
 *
 * So: optimize what we can prove is configured, and fall back to a plain
 * <img> for anything else. A slightly unoptimized image is a much better
 * outcome than a 500 on the customer-facing page.
 *
 * `fill` requires the parent to be positioned — every caller here wraps it
 * in a `relative` container.
 */

function isOptimizable(src: string): boolean {
  // App-relative paths are always served by us.
  if (src.startsWith("/")) return true;

  try {
    const host = new URL(src).hostname;
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
    return host === supabaseHost;
  } catch {
    return false;
  }
}

type StorefrontImageProps = {
  src: string;
  /**
   * Required, and not optional-with-a-default: every storefront image
   * needs real alternative text for accessibility and image search.
   * Callers pass the stored alt_text with a meaningful fallback.
   */
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

export function StorefrontImage({ src, alt, className, sizes, priority }: StorefrontImageProps) {
  if (isOptimizable(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? "100vw"}
        priority={priority}
        className={className}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`absolute inset-0 size-full ${className ?? ""}`}
    />
  );
}

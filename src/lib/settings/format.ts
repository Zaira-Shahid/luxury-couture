/**
 * Money formatting, from the configured currency and locale rather than
 * the `Intl.NumberFormat("en-GB", …, "GBP")` that was hardcoded in ~13
 * files before Module 25. Changing the currency in Admin → Settings now
 * changes what customers actually see.
 *
 * NO IMPORTS on purpose — CLIENT components format money too (the cart
 * row), and anything importing `getSiteSettings` drags `next/headers`
 * into the client bundle and fails the build. The settings-reading half
 * lives in `get-money-formatter.ts`. Same split as `lib/email/render.ts`
 * vs `layout.ts`, for the same reason.
 */

const FALLBACK_CURRENCY = "GBP";
const FALLBACK_LOCALE = "en-GB";

/**
 * `Intl.NumberFormat` THROWS on an invalid currency code rather than
 * degrading, which would take a page down over a settings typo. The
 * registry constrains the field to a select, but a row written by hand
 * via the Supabase dashboard would not be — so this catches and falls
 * back.
 */
export function formatMoney(
  amount: number,
  currency: string = FALLBACK_CURRENCY,
  locale: string = FALLBACK_LOCALE
): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return new Intl.NumberFormat(FALLBACK_LOCALE, {
      style: "currency",
      currency: FALLBACK_CURRENCY,
    }).format(amount);
  }
}

/** Date formatting against the configured locale, for the same reason. */
export function formatDate(iso: string, locale: string = FALLBACK_LOCALE): string {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return new Date(iso).toLocaleDateString(FALLBACK_LOCALE);
  }
}

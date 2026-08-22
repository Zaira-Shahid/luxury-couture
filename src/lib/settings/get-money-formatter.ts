import { formatMoney } from "./format";
import { getSiteSettings } from "./get-site-settings";

/**
 * The settings-reading half of money formatting. Server-only, because it
 * reads `site_settings`; the pure `formatMoney` in `format.ts` is what
 * client components use.
 */
export type MoneyFormatter = {
  format: (amount: number) => string;
  currency: string;
  locale: string;
};

/** Resolves the shop's configured currency and locale once per request. */
export async function getMoneyFormatter(): Promise<MoneyFormatter> {
  const settings = await getSiteSettings();
  const { currency, locale } = settings.general;
  return {
    format: (amount: number) => formatMoney(amount, currency, locale),
    currency,
    locale,
  };
}

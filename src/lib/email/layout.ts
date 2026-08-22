import { siteConfig } from "@/lib/config/site";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

import type { EmailBrand } from "./render";

/**
 * Resolves the brand values every email renders with, from the same site
 * settings the storefront uses (Module 3) — so an admin changing the logo
 * changes the emails too, with no separate configuration.
 *
 * The rendering itself lives in render.ts, which is deliberately
 * import-free so it can be unit-tested directly. This file is the half
 * that needs the database.
 */
export async function getEmailBrand(): Promise<EmailBrand> {
  const settings = await getSiteSettings();
  return {
    name: settings.seo.defaultTitle ?? siteConfig.name,
    logoUrl: settings.branding.logoUrl,
    // Brand colours are stored as oklch() for the site's CSS, which email
    // clients do not understand. Falling back to a neutral dark keeps the
    // email readable rather than rendering an unstyled or invisible
    // button — a deliberate downgrade, not an oversight.
    accent: "#1a1a1a",
    contactEmail: settings.store.contactEmail,
    footerText: settings.store.footerText,
  };
}

export {
  buildMarketingEmail,
  buildTransactionalEmail,
  escapeHtml,
  type EmailBody,
  type EmailBrand,
  type RenderedEmail,
} from "./render";

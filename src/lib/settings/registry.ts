/**
 * The declarative settings registry — one entry per configurable value.
 *
 * Before this, adding a setting meant four edits that could silently
 * drift: a field on `SiteSettings`, a default, a `case` in `applyRow`,
 * and a form input. The registry is the single description; parsing,
 * defaults and the admin form all derive from it.
 *
 * NO IMPORTS on purpose — the same rule as `lib/ai/guardrails.ts` and
 * `lib/email/render.ts`. `scripts/test-settings-*.mjs` imports this `.ts`
 * directly under Node's type stripping, where `@/...` aliases do not
 * resolve. Keep it dependency-free.
 *
 * TWO THINGS THAT ARE DELIBERATELY NOT HERE:
 *
 *  - **Secrets.** `ANTHROPIC_API_KEY`, `RESEND_API_KEY` and
 *    `STRIPE_SECRET_KEY` stay in environment variables. Settings rows are
 *    readable by every admin and stored unencrypted; live credentials do
 *    not belong there. The settings screen shows whether each is
 *    configured, never its value.
 *  - **Anything with no effect.** Every entry below changes something
 *    visible. A field that only stores a value is worse than no field,
 *    because it implies a behaviour that isn't there.
 *
 * The storage key's prefix is historical, not a section: `store.*` keys
 * predate this registry and are surfaced under "General". Renaming them
 * would orphan existing rows for no benefit.
 */

export type SettingSection =
  | "general"
  | "theme"
  | "seo"
  | "analytics"
  | "ai";

export type SettingType = "text" | "textarea" | "boolean" | "select" | "number";

export type SettingEntry = {
  /** Storage key in `site_settings`. Never change one — it orphans rows. */
  key: string;
  /** Path into the typed `SiteSettings` object, e.g. ["theme", "primary"]. */
  path: [string, string];
  section: SettingSection;
  type: SettingType;
  label: string;
  help?: string;
  /** For `select`. */
  options?: { value: string; label: string }[];
  placeholder?: string;
};

export const FONT_PRESETS = [
  { value: "cormorant-geist", label: "Cormorant Garamond + Geist (default)" },
  { value: "playfair-inter", label: "Playfair Display + Inter" },
  { value: "libre-source", label: "Libre Baskerville + Source Sans 3" },
] as const;

export type FontPreset = (typeof FONT_PRESETS)[number]["value"];

/**
 * Only currencies the shop realistically quotes in. A free-text field
 * would let someone type "£" and break `Intl.NumberFormat`, which throws
 * on an invalid currency code rather than degrading.
 */
export const CURRENCIES = [
  { value: "GBP", label: "British Pound (£)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "US Dollar ($)" },
  { value: "AED", label: "UAE Dirham (د.إ)" },
  { value: "PKR", label: "Pakistani Rupee (₨)" },
] as const;

export const LOCALES = [
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-US", label: "English (United States)" },
  { value: "en-AE", label: "English (United Arab Emirates)" },
  { value: "en-PK", label: "English (Pakistan)" },
] as const;

export const SETTINGS_REGISTRY: SettingEntry[] = [
  // ---- General ----------------------------------------------------------
  {
    key: "seo.default_title",
    path: ["seo", "defaultTitle"],
    section: "general",
    type: "text",
    label: "Brand name",
    help: "Used as the site title, in emails, and in structured data.",
  },
  {
    key: "branding.logo_url",
    path: ["branding", "logoUrl"],
    section: "general",
    type: "text",
    label: "Logo URL",
    help: "Shown in the site header and at the top of every email.",
  },
  {
    key: "branding.favicon_url",
    path: ["branding", "faviconUrl"],
    section: "general",
    type: "text",
    label: "Favicon URL",
  },
  {
    key: "store.contact_email",
    path: ["store", "contactEmail"],
    section: "general",
    type: "text",
    label: "Contact email",
    help: "Shown in the footer, in emails, and offered by the assistant when it cannot answer.",
  },
  {
    key: "store.contact_phone",
    path: ["store", "contactPhone"],
    section: "general",
    type: "text",
    label: "Contact phone",
  },
  {
    key: "store.contact_address",
    path: ["store", "contactAddress"],
    section: "general",
    type: "textarea",
    label: "Contact address",
  },
  {
    key: "store.footer_text",
    path: ["store", "footerText"],
    section: "general",
    type: "text",
    label: "Footer text",
    help: "Replaces the default copyright line.",
  },
  {
    key: "general.currency",
    path: ["general", "currency"],
    section: "general",
    type: "select",
    label: "Currency",
    help: "Applies to prices shown across the site and to new orders. Existing orders keep the currency they were placed in.",
    options: CURRENCIES.map((c) => ({ value: c.value, label: c.label })),
  },
  {
    key: "general.locale",
    path: ["general", "locale"],
    section: "general",
    type: "select",
    label: "Number and date format",
    options: LOCALES.map((l) => ({ value: l.value, label: l.label })),
  },
  {
    key: "general.country",
    path: ["general", "country"],
    section: "general",
    type: "text",
    label: "Country",
    help: "Where the business operates. Used in structured data and on invoices.",
    placeholder: "United Kingdom",
  },
  {
    key: "general.timezone",
    path: ["general", "timezone"],
    section: "general",
    type: "text",
    label: "Timezone",
    help: "Used when displaying dates in the admin.",
    placeholder: "Europe/London",
  },

  // ---- Theme ------------------------------------------------------------
  {
    key: "theme.primary",
    path: ["theme", "primary"],
    section: "theme",
    type: "text",
    label: "Primary colour",
    help: "Any CSS colour. Leave blank to use the built-in default.",
    placeholder: "oklch(0.35 0.08 20)",
  },
  {
    key: "theme.accent",
    path: ["theme", "accent"],
    section: "theme",
    type: "text",
    label: "Accent colour",
    placeholder: "oklch(0.75 0.12 80)",
  },
  {
    key: "theme.background",
    path: ["theme", "background"],
    section: "theme",
    type: "text",
    label: "Background colour",
    placeholder: "oklch(0.98 0.005 90)",
  },
  {
    key: "theme.foreground",
    path: ["theme", "foreground"],
    section: "theme",
    type: "text",
    label: "Text colour",
    placeholder: "oklch(0.2 0.01 60)",
  },
  {
    key: "theme.radius",
    path: ["theme", "radius"],
    section: "theme",
    type: "text",
    label: "Corner radius",
    help: "A CSS length, e.g. 0.5rem. Affects buttons, cards and inputs.",
    placeholder: "0.625rem",
  },
  {
    key: "theme.font_preset",
    path: ["theme", "fontPreset"],
    section: "theme",
    type: "select",
    label: "Typography",
    help: "Font pairings are loaded at build time, so this is a choice between prepared sets rather than any font name.",
    options: FONT_PRESETS.map((f) => ({ value: f.value, label: f.label })),
  },

  // ---- SEO --------------------------------------------------------------
  {
    key: "seo.default_description",
    path: ["seo", "defaultDescription"],
    section: "seo",
    type: "textarea",
    label: "Default meta description",
  },
  {
    key: "seo.default_og_image_url",
    path: ["seo", "defaultOgImageUrl"],
    section: "seo",
    type: "text",
    label: "Default share image URL",
    help: "Recommended 1200×630.",
  },
  {
    key: "seo.twitter_handle",
    path: ["seo", "twitterHandle"],
    section: "seo",
    type: "text",
    label: "Twitter/X handle",
    placeholder: "@yourbrand",
  },
  {
    key: "seo.google_site_verification",
    path: ["seo", "googleSiteVerification"],
    section: "seo",
    type: "text",
    label: "Google Search Console token",
    help: "The content value from Google's HTML tag method, not the whole tag.",
  },
  {
    key: "seo.indexing_enabled",
    path: ["seo", "indexingEnabled"],
    section: "seo",
    type: "boolean",
    label: "Allow search engines to index this site",
    help: "Off by default so a pre-launch site is never crawled. While off, robots.txt blocks everything and every page sends noindex. Turn this on at launch.",
  },

  // ---- Analytics --------------------------------------------------------
  {
    key: "analytics.ga_measurement_id",
    path: ["analytics", "gaMeasurementId"],
    section: "analytics",
    type: "text",
    label: "Google Analytics measurement ID",
    help: "Public identifier, not a secret. Only loads for visitors who accepted marketing cookies.",
    placeholder: "G-XXXXXXXXXX",
  },
  {
    key: "analytics.meta_pixel_id",
    path: ["analytics", "metaPixelId"],
    section: "analytics",
    type: "text",
    label: "Meta Pixel ID",
  },
  {
    key: "analytics.tiktok_pixel_id",
    path: ["analytics", "tiktokPixelId"],
    section: "analytics",
    type: "text",
    label: "TikTok Pixel ID",
  },

  // ---- AI ---------------------------------------------------------------
  {
    key: "ai.assistant_enabled",
    path: ["ai", "assistantEnabled"],
    section: "ai",
    type: "boolean",
    label: "Show the customer assistant",
    help: "The chat bubble on the storefront. Turning this off removes it entirely.",
  },
  {
    key: "ai.admin_drafting_enabled",
    path: ["ai", "adminDraftingEnabled"],
    section: "ai",
    type: "boolean",
    label: "Allow AI drafting in the admin",
    help: "The “Write with AI” and “Draft” buttons on the product and order screens.",
  },
];

export const SECTION_LABELS: Record<SettingSection, string> = {
  general: "General",
  theme: "Theme",
  seo: "SEO",
  analytics: "Analytics",
  ai: "AI",
};

/** Section order in the admin tabs. */
export const SECTION_ORDER: SettingSection[] = ["general", "theme", "seo", "analytics", "ai"];

export function entriesForSection(section: SettingSection): SettingEntry[] {
  return SETTINGS_REGISTRY.filter((entry) => entry.section === section);
}

export function findEntry(key: string): SettingEntry | undefined {
  return SETTINGS_REGISTRY.find((entry) => entry.key === key);
}

/**
 * Environment-only credentials. Listed so the settings screen can report
 * whether each is configured WITHOUT ever reading or rendering the value.
 * Adding a key here is how a new integration becomes visible to the
 * owner; adding it to SETTINGS_REGISTRY instead would put a live
 * credential in the database.
 */
export const ENV_CREDENTIALS = [
  { env: "STRIPE_SECRET_KEY", label: "Stripe", help: "Card payments. Without it, payments fall back to manual/offline collection." },
  { env: "ANTHROPIC_API_KEY", label: "Claude (AI)", help: "Upgrades FAQ answering and admin drafting. Without it, the free deterministic engine is used." },
  { env: "RESEND_API_KEY", label: "Resend (email)", help: "Real email delivery. Without it, emails are logged instead of sent." },
  { env: "CRON_SECRET", label: "Cron secret", help: "Protects the scheduled jobs that purge analytics and detect abandoned carts. MUST be set before launch." },
] as const;

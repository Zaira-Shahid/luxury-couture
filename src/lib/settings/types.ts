import type { FontPreset } from "./registry";

export type SocialLinks = {
  instagram?: string;
  facebook?: string;
  pinterest?: string;
  whatsapp?: string;
};

/**
 * The full, always-populated settings shape the app reads from.
 * `getSiteSettings()` merges rows from `site_settings` (namespaced keys,
 * e.g. "theme.primary") over these defaults, so every field is always
 * defined even when the table has zero rows — today's real state.
 *
 * This type stays hand-written even though Module 25 added a declarative
 * registry (`registry.ts`), because a type derived from a runtime array
 * loses the per-field nullability that call sites depend on. The registry
 * drives *parsing and the admin form*; this drives *reading*. A test
 * asserts every registry path exists here, so the two cannot drift
 * silently.
 *
 * `store.announcementEnabled`/`announcementText` (Module 3's single
 * global on/off banner) were removed here — Module 19 Pass 2 replaced
 * that mechanism with `promotional_banners` (multiple, scheduled,
 * admin-managed). Any leftover `store.announcement_*` rows in
 * `site_settings` are harmlessly ignored.
 */
export type SiteSettings = {
  general: {
    /** ISO 4217 code. Applies to display and to NEW orders only. */
    currency: string;
    /** BCP 47 tag used for number and date formatting. */
    locale: string;
    country: string | null;
    timezone: string | null;
  };
  theme: {
    /** oklch(...) or any CSS colour, or null to use the CSS default. */
    primary: string | null;
    accent: string | null;
    background: string | null;
    foreground: string | null;
    /** A CSS length, e.g. "0.625rem". */
    radius: string | null;
    /** One of FONT_PRESETS — fonts are build-time, so this is a choice, not a font name. */
    fontPreset: FontPreset;
  };
  branding: {
    logoUrl: string | null;
    faviconUrl: string | null;
  };
  store: {
    socialLinks: SocialLinks;
    contactEmail: string | null;
    contactPhone: string | null;
    contactAddress: string | null;
    footerText: string | null;
  };
  seo: {
    defaultTitle: string | null;
    defaultDescription: string | null;
    defaultOgImageUrl: string | null;
    /** "@handle" used for Twitter/X card attribution. */
    twitterHandle: string | null;
    /** Google Search Console HTML-tag verification token. */
    googleSiteVerification: string | null;
    /**
     * Master switch for search indexing. Defaults to false so a
     * pre-launch/staging deploy is never indexed by accident.
     */
    indexingEnabled: boolean;
  };
  /**
   * Public tracking identifiers — NOT secrets. Moved out of
   * NEXT_PUBLIC_* env vars in Module 25 so they can be changed without a
   * redeploy. The env vars remain as a fallback for existing deploys.
   */
  analytics: {
    gaMeasurementId: string | null;
    metaPixelId: string | null;
    tiktokPixelId: string | null;
  };
  /** Feature toggles only. API keys stay in the environment. */
  ai: {
    assistantEnabled: boolean;
    adminDraftingEnabled: boolean;
  };
  homepage: {
    seoTitle: string | null;
    seoDescription: string | null;
    heroHeading: string | null;
    heroSubheading: string | null;
    heroImageUrl: string | null;
  };
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  general: {
    currency: "GBP",
    locale: "en-GB",
    country: null,
    timezone: null,
  },
  theme: {
    primary: null,
    accent: null,
    background: null,
    foreground: null,
    radius: null,
    fontPreset: "cormorant-geist",
  },
  branding: { logoUrl: null, faviconUrl: null },
  store: {
    socialLinks: {},
    contactEmail: null,
    contactPhone: null,
    contactAddress: null,
    footerText: null,
  },
  seo: {
    defaultTitle: null,
    defaultDescription: null,
    defaultOgImageUrl: null,
    twitterHandle: null,
    googleSiteVerification: null,
    indexingEnabled: false,
  },
  analytics: {
    gaMeasurementId: null,
    metaPixelId: null,
    tiktokPixelId: null,
  },
  ai: {
    // Both default ON: the deterministic engine is free and works with no
    // configuration, so there is nothing to protect against by default.
    assistantEnabled: true,
    adminDraftingEnabled: true,
  },
  homepage: {
    seoTitle: null,
    seoDescription: null,
    heroHeading: null,
    heroSubheading: null,
    heroImageUrl: null,
  },
};

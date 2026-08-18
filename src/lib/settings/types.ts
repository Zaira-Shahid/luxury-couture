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
 */
export type SiteSettings = {
  theme: {
    /** oklch(...) string, or null to use the CSS default. */
    primary: string | null;
    accent: string | null;
  };
  branding: {
    logoUrl: string | null;
    faviconUrl: string | null;
  };
  store: {
    announcementEnabled: boolean;
    announcementText: string | null;
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
  };
  homepage: {
    seoTitle: string | null;
    seoDescription: string | null;
  };
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  theme: { primary: null, accent: null },
  branding: { logoUrl: null, faviconUrl: null },
  store: {
    announcementEnabled: false,
    announcementText: null,
    socialLinks: {},
    contactEmail: null,
    contactPhone: null,
    contactAddress: null,
    footerText: null,
  },
  seo: { defaultTitle: null, defaultDescription: null, defaultOgImageUrl: null },
  homepage: { seoTitle: null, seoDescription: null },
};

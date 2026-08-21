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
 * `store.announcementEnabled`/`announcementText` (Module 3's single
 * global on/off banner) were removed here — Module 19 Pass 2 replaced
 * that mechanism with `promotional_banners` (multiple, scheduled,
 * admin-managed). Any leftover `store.announcement_*` rows in
 * `site_settings` are harmlessly ignored by `applyRow`'s default case.
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
     * pre-launch/staging deploy is never indexed by accident — the owner
     * turns it on in Admin → SEO when the site goes live. Drives both
     * `robots.txt` and every page's robots meta tag.
     */
    indexingEnabled: boolean;
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
  theme: { primary: null, accent: null },
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
  homepage: {
    seoTitle: null,
    seoDescription: null,
    heroHeading: null,
    heroSubheading: null,
    heroImageUrl: null,
  },
};

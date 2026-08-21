export type SocialPost = {
  id: string;
  imageUrl: string;
  caption: string | null;
  permalink: string | null;
};

/**
 * Free-first provider abstraction (Master Build Plan §3), same pattern as
 * lib/shipping/. Only a mock implementation exists — no real Instagram API
 * credentials exist to integrate against, same deferral as Modules 11/14's
 * PayPal/courier decisions. A real Instagram Basic Display/Graph API
 * implementation can swap in later without touching call sites.
 */
export interface InstagramProvider {
  getRecentPosts(limit: number): Promise<SocialPost[]>;
}

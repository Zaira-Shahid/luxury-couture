import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import type { WriteResult } from "@/lib/orders/write-orders";

/**
 * Content WRITE services — Module 40.
 *
 * TWO THINGS LIVE HERE, and they are here together because both are "the
 * words on the site": the promotional banner that runs across the top of
 * the storefront, and AI-drafted long-form content.
 *
 * THE BANNER IS NOT "THE ANNOUNCEMENT". Module 40 was specified with a
 * `content_update_announcement` tool. That mechanism no longer exists —
 * Module 3's single global `store.announcement_*` on/off banner was
 * replaced in Module 19 Pass 2 by `promotional_banners`: several,
 * scheduled, each with its own active flag. The leftover settings keys
 * are explicitly ignored (`lib/settings/types.ts`). Writing a tool
 * against them would have produced a tool that appeared to work and
 * changed nothing a visitor could see.
 *
 * AI DRAFTS ARE ALWAYS DRAFTS. 12B.12 forbids automatic publication of
 * AI-written copy and requires it to be marked. `draftBlogPostRecord`
 * hard-codes `status: "draft"` and `ai_generated: true` rather than
 * accepting either as an argument — a status parameter here would be a
 * publish tool with a gentler name, and a marking parameter would let the
 * caller claim a person wrote it.
 */

export type BannerInput = {
  text: string;
  linkUrl?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  sortOrder?: number;
  /**
   * Only the ADMIN FORM passes this. The form has a single "active"
   * checkbox and has always saved it alongside the text, so refusing it
   * here would change an admin screen this module has no business
   * changing. No tool passes it: making a banner visible is
   * `content_set_banner_active`, which is high risk and confirmed,
   * and an editor that could also switch it on would be that tool
   * without the confirmation. Same shape as Module 38's `status`.
   */
  isActive?: boolean;
};

/**
 * Creates a banner, HIDDEN unless the caller says otherwise.
 *
 * The same shape Module 38 gave `collections_create` and
 * `builder_options_create`: a thing every visitor will see is not
 * switched on by the call that creates it. Only the admin form passes
 * `isActive` — for tools the default stands, and making a banner visible
 * is `setBannerActive` behind a confirmation.
 */
export async function createBannerRecord(
  input: BannerInput,
  client: SupabaseClient
): Promise<WriteResult<{ id: string }>> {
  const { data, error } = await client
    .from("promotional_banners")
    .insert({
      text: input.text,
      link_url: input.linkUrl || null,
      starts_at: input.startsAt || null,
      expires_at: input.expiresAt || null,
      sort_order: input.sortOrder ?? 0,
      // Defaults to hidden when the caller does not say — which is every
      // tool. See BannerInput.isActive.
      is_active: input.isActive ?? false,
    })
    .select("id")
    .single();

  if (error || !data) {
    logger.error("banner create failed", error);
    return { ok: false, error: "Could not create this banner." };
  }

  return { ok: true, data: { id: data.id } };
}

/**
 * Edits a banner. Omitted fields are left alone; an explicit null clears
 * a nullable one. `isActive` is reachable only by the admin form, which
 * posts its checkbox on every save — no tool passes it.
 */
export async function updateBannerRecord(
  id: string,
  input: Partial<BannerInput>,
  client: SupabaseClient
): Promise<WriteResult<{ id: string }>> {
  const { data: existing } = await client
    .from("promotional_banners")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Banner not found." };

  const patch: Record<string, unknown> = {};
  if (input.text !== undefined) patch.text = input.text;
  if (input.linkUrl !== undefined) patch.link_url = input.linkUrl || null;
  if (input.startsAt !== undefined) patch.starts_at = input.startsAt || null;
  if (input.expiresAt !== undefined) patch.expires_at = input.expiresAt || null;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update." };

  const { error } = await client.from("promotional_banners").update(patch).eq("id", id);
  if (error) {
    logger.error("banner update failed", error, { id });
    return { ok: false, error: "Could not update this banner." };
  }

  return { ok: true, data: { id } };
}

/** Shows or hides a banner. Its own function because its own tool. */
export async function setBannerActive(
  id: string,
  active: boolean,
  client: SupabaseClient
): Promise<WriteResult<{ id: string; isActive: boolean; previous: boolean; text: string }>> {
  const { data: existing } = await client
    .from("promotional_banners")
    .select("id, is_active, text")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Banner not found." };

  const { error } = await client
    .from("promotional_banners")
    .update({ is_active: active })
    .eq("id", id);

  if (error) {
    logger.error("banner visibility change failed", error, { id });
    return { ok: false, error: "Could not change this banner's visibility." };
  }

  return {
    ok: true,
    data: { id, isActive: active, previous: existing.is_active, text: existing.text },
  };
}

export type BlogDraftInput = {
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  coverImageUrl?: string | null;
};

/**
 * Stores an AI-drafted blog post.
 *
 * ALWAYS A DRAFT, ALWAYS MARKED. Neither `status` nor `ai_generated` is a
 * parameter, and that is the whole enforcement of 12B.12 in this module:
 * the rule that AI copy is never auto-published cannot be broken by an
 * argument that does not exist. Publishing it remains a person's action
 * in /admin/content, which is also the review step — the plan's
 * draft -> review -> approve -> publish has only two states in this
 * schema, and migration 0064 says why they were not invented.
 *
 * The MODEL writes the words; this stores them. Nothing here calls an
 * LLM — the assistant on the other end of the tool call is the author,
 * and a second generation step inside the tool would produce copy nobody
 * asked for and nobody reviewed.
 */
export async function draftBlogPostRecord(
  input: BlogDraftInput,
  client: SupabaseClient
): Promise<WriteResult<{ id: string; status: "draft"; aiGenerated: true }>> {
  const { data, error } = await client
    .from("blog_posts")
    .insert({
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt || null,
      content: input.content || null,
      cover_image_url: input.coverImageUrl || null,
      status: "draft",
      published_at: null,
      ai_generated: true,
      ai_generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    logger.error("ai blog draft failed", error);
    return {
      ok: false,
      error: error?.code === "23505" ? "A post with that slug already exists." : "Could not save this draft.",
    };
  }

  return { ok: true, data: { id: data.id, status: "draft", aiGenerated: true } };
}

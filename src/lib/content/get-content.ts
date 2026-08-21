import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { BlogPost, Faq, Page } from "@/types/database";

/**
 * Public read fetchers for the content tables created in Module 1
 * (`blog_posts`, `pages`) and Module 20 (`faqs`).
 *
 * Every query filters on the published/active flag *and* is backed by an
 * RLS policy that does the same, so a draft is invisible at the database
 * level too — the filter here is for correct behaviour, not for security.
 * Admin reads deliberately use the separate helpers in `lib/admin/`.
 */

export const getPublishedBlogPosts = cache(async (): Promise<BlogPost[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) {
    logger.warn("failed to load blog posts", { message: error.message });
    return [];
  }
  return (data ?? []) as BlogPost[];
});

export const getBlogPostBySlug = cache(async (slug: string): Promise<BlogPost | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    logger.warn("failed to load blog post", { message: error.message, slug });
    return null;
  }
  return (data ?? null) as BlogPost | null;
});

export const getPublishedPages = cache(async (): Promise<Page[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .eq("status", "published")
    .order("title", { ascending: true });

  if (error) {
    logger.warn("failed to load pages", { message: error.message });
    return [];
  }
  return (data ?? []) as Page[];
});

export const getPageBySlug = cache(async (slug: string): Promise<Page | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    logger.warn("failed to load page", { message: error.message, slug });
    return null;
  }
  return (data ?? null) as Page | null;
});

export const getActiveFaqs = cache(async (): Promise<Faq[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    logger.warn("failed to load faqs", { message: error.message });
    return [];
  }
  return (data ?? []) as Faq[];
});

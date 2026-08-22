import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { BlogPost, Faq, Occasion, Page } from "@/types/database";

/**
 * Admin content reads — unlike `lib/content/get-content.ts` these are
 * unfiltered by status, so drafts are visible. RLS still gates them: the
 * "published or admin" policies from 0011/0045 return only published rows
 * to anyone who isn't an admin, so a non-admin hitting these paths sees
 * nothing extra even before the route guard.
 */

export async function getAdminBlogPosts(): Promise<BlogPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load admin blog posts", { message: error.message });
    return [];
  }
  return (data ?? []) as BlogPost[];
}

export async function getAdminBlogPost(id: string): Promise<BlogPost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("blog_posts").select("*").eq("id", id).maybeSingle();

  if (error) {
    logger.warn("failed to load admin blog post", { id, message: error.message });
    return null;
  }
  return (data ?? null) as BlogPost | null;
}

export async function getAdminPages(): Promise<Page[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load admin pages", { message: error.message });
    return [];
  }
  return (data ?? []) as Page[];
}

export async function getAdminPage(id: string): Promise<Page | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pages").select("*").eq("id", id).maybeSingle();

  if (error) {
    logger.warn("failed to load admin page", { id, message: error.message });
    return null;
  }
  return (data ?? null) as Page | null;
}

export async function getAdminFaqs(): Promise<Faq[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    logger.warn("failed to load admin faqs", { message: error.message });
    return [];
  }
  return (data ?? []) as Faq[];
}

export async function getAdminFaq(id: string): Promise<Faq | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("faqs").select("*").eq("id", id).maybeSingle();

  if (error) {
    logger.warn("failed to load admin faq", { id, message: error.message });
    return null;
  }
  return (data ?? null) as Faq | null;
}

export async function getAdminOccasions(): Promise<Occasion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("occasions")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    logger.warn("failed to load admin occasions", { message: error.message });
    return [];
  }
  return (data ?? []) as Occasion[];
}

export async function getAdminOccasion(id: string): Promise<Occasion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("occasions").select("*").eq("id", id).maybeSingle();

  if (error) {
    logger.warn("failed to load admin occasion", { id, message: error.message });
    return null;
  }
  return (data ?? null) as Occasion | null;
}

export type UnansweredQuestion = {
  id: string;
  content: string;
  created_at: string;
};

/**
 * The FAQ backlog (Module 23): questions customers asked that the
 * assistant could not answer. This is the most actionable output of the
 * chatbot — each row is a FAQ worth writing.
 */
export async function getUnansweredQuestions(limit = 50): Promise<UnansweredQuestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, content, created_at")
    .eq("role", "user")
    .eq("unanswered", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.warn("failed to load unanswered questions", { message: error.message });
    return [];
  }
  return (data ?? []) as UnansweredQuestion[];
}

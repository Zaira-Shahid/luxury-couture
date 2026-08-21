"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { blogPostSchema, faqSchema, pageSchema } from "@/lib/validations/content";

export type ActionResult = { error: string } | undefined;

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

/** Postgres unique-violation — a duplicate slug, in practice. */
function isUniqueViolation(error: { code?: string }) {
  return error.code === "23505";
}

// ---- Blog posts ----------------------------------------------------------

function parsePost(formData: FormData) {
  return blogPostSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    excerpt: formData.get("excerpt") || "",
    content: formData.get("content") || "",
    coverImageUrl: formData.get("coverImageUrl") || "",
    status: formData.get("status"),
  });
}

export async function createBlogPost(formData: FormData): Promise<ActionResult> {
  const parsed = parsePost(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("blog_posts").insert({
    title: parsed.data.title,
    slug: parsed.data.slug,
    excerpt: parsed.data.excerpt || null,
    content: parsed.data.content || null,
    cover_image_url: parsed.data.coverImageUrl || null,
    status: parsed.data.status,
    // published_at is what the blog index orders by and what the
    // BlogPosting schema reports, so stamp it the moment a post first
    // goes live rather than leaving it null.
    published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
  });
  if (error) {
    logger.error("blog post creation failed", error);
    return {
      error: isUniqueViolation(error)
        ? "A post with that slug already exists."
        : "Could not create this post.",
    };
  }

  revalidatePath("/admin/content");
  revalidatePath("/blog");
  redirect("/admin/content");
}

export async function updateBlogPost(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parsePost(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();

  // Preserve the original publish date across edits; only stamp it if the
  // post is going live for the first time.
  const { data: existing } = await supabase
    .from("blog_posts")
    .select("published_at")
    .eq("id", id)
    .maybeSingle();
  const publishedAt =
    parsed.data.status === "published"
      ? (existing?.published_at ?? new Date().toISOString())
      : existing?.published_at ?? null;

  const { error } = await supabase
    .from("blog_posts")
    .update({
      title: parsed.data.title,
      slug: parsed.data.slug,
      excerpt: parsed.data.excerpt || null,
      content: parsed.data.content || null,
      cover_image_url: parsed.data.coverImageUrl || null,
      status: parsed.data.status,
      published_at: publishedAt,
    })
    .eq("id", id);
  if (error) {
    logger.error("blog post update failed", error, { id });
    return {
      error: isUniqueViolation(error)
        ? "A post with that slug already exists."
        : "Could not update this post.",
    };
  }

  revalidatePath("/admin/content");
  revalidatePath("/blog");
  revalidatePath(`/blog/${parsed.data.slug}`);
  return undefined;
}

export async function deleteBlogPost(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) {
    logger.error("blog post delete failed", error, { id });
    return { error: "Could not delete this post." };
  }

  revalidatePath("/admin/content");
  revalidatePath("/blog");
  return undefined;
}

// ---- CMS pages -----------------------------------------------------------

function parsePage(formData: FormData) {
  return pageSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    content: formData.get("content") || "",
    status: formData.get("status"),
  });
}

export async function createPage(formData: FormData): Promise<ActionResult> {
  const parsed = parsePage(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("pages").insert({
    title: parsed.data.title,
    slug: parsed.data.slug,
    content: parsed.data.content || null,
    status: parsed.data.status,
  });
  if (error) {
    logger.error("page creation failed", error);
    return {
      error: isUniqueViolation(error)
        ? "A page with that slug already exists."
        : "Could not create this page.",
    };
  }

  revalidatePath("/admin/content");
  redirect("/admin/content");
}

export async function updatePage(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parsePage(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .update({
      title: parsed.data.title,
      slug: parsed.data.slug,
      content: parsed.data.content || null,
      status: parsed.data.status,
    })
    .eq("id", id);
  if (error) {
    logger.error("page update failed", error, { id });
    return {
      error: isUniqueViolation(error)
        ? "A page with that slug already exists."
        : "Could not update this page.",
    };
  }

  revalidatePath("/admin/content");
  revalidatePath(`/${parsed.data.slug}`);
  return undefined;
}

export async function deletePage(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("pages").delete().eq("id", id);
  if (error) {
    logger.error("page delete failed", error, { id });
    return { error: "Could not delete this page." };
  }

  revalidatePath("/admin/content");
  return undefined;
}

// ---- FAQs ----------------------------------------------------------------

function parseFaq(formData: FormData) {
  return faqSchema.safeParse({
    question: formData.get("question"),
    answer: formData.get("answer"),
    category: formData.get("category") || "",
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "on",
  });
}

export async function createFaq(formData: FormData): Promise<ActionResult> {
  const parsed = parseFaq(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("faqs").insert({
    question: parsed.data.question,
    answer: parsed.data.answer,
    category: parsed.data.category || null,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive,
  });
  if (error) {
    logger.error("faq creation failed", error);
    return { error: "Could not create this FAQ." };
  }

  revalidatePath("/admin/content");
  revalidatePath("/faq");
  redirect("/admin/content");
}

export async function updateFaq(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseFaq(formData);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("faqs")
    .update({
      question: parsed.data.question,
      answer: parsed.data.answer,
      category: parsed.data.category || null,
      sort_order: parsed.data.sortOrder,
      is_active: parsed.data.isActive,
    })
    .eq("id", id);
  if (error) {
    logger.error("faq update failed", error, { id });
    return { error: "Could not update this FAQ." };
  }

  revalidatePath("/admin/content");
  revalidatePath("/faq");
  return undefined;
}

export async function deleteFaq(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("faqs").delete().eq("id", id);
  if (error) {
    logger.error("faq delete failed", error, { id });
    return { error: "Could not delete this FAQ." };
  }

  revalidatePath("/admin/content");
  revalidatePath("/faq");
  return undefined;
}

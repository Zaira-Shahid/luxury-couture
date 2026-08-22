"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/features/admin-content/actions";
import type { BlogPost, Faq, Occasion, Page } from "@/types/database";

/**
 * The three content editors. They share the submit/pending/error shape
 * used by every other admin form in the project (see
 * admin/marketing/banners/banner-form.tsx) — a client wrapper calling a
 * server action inside useTransition, since React 18 has no
 * useActionState (documented in docs/ARCHITECTURE.md).
 */
function useFormAction(action: (formData: FormData) => Promise<ActionResult>, successMessage: string) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result) setError(result.error);
      else toast.success(successMessage);
    });
  }

  return { isPending, error, handleSubmit };
}

function StatusField({ defaultValue }: { defaultValue: "draft" | "published" }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="status">Status</Label>
      <select
        id="status"
        name="status"
        defaultValue={defaultValue}
        className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
      >
        <option value="draft">Draft — not visible to the public</option>
        <option value="published">Published — live on the site</option>
      </select>
    </div>
  );
}

export function BlogPostForm({
  post,
  action,
}: {
  post?: BlogPost;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const { isPending, error, handleSubmit } = useFormAction(
    action,
    post ? "Post updated." : "Post created."
  );

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={post?.title} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" defaultValue={post?.slug} placeholder="choosing-your-fabric" required />
          <p className="text-xs text-muted-foreground">URL: /blog/your-slug</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="excerpt">Excerpt</Label>
        <Textarea id="excerpt" name="excerpt" rows={2} defaultValue={post?.excerpt ?? ""} />
        <p className="text-xs text-muted-foreground">
          Shown on the journal index and used as the meta description.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="content">Content</Label>
        <Textarea id="content" name="content" rows={14} defaultValue={post?.content ?? ""} />
        <p className="text-xs text-muted-foreground">
          Plain text. Leave a blank line between paragraphs.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="coverImageUrl">Cover image URL</Label>
        <Input id="coverImageUrl" name="coverImageUrl" defaultValue={post?.cover_image_url ?? ""} />
      </div>
      <StatusField defaultValue={post?.status ?? "draft"} />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : post ? "Save changes" : "Create post"}
      </Button>
    </form>
  );
}

export function PageForm({
  page,
  action,
}: {
  page?: Page;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const { isPending, error, handleSubmit } = useFormAction(
    action,
    page ? "Page updated." : "Page created."
  );

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={page?.title} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" defaultValue={page?.slug} placeholder="about" required />
          <p className="text-xs text-muted-foreground">
            URL: /your-slug. Slugs used by real site routes (products, cart, blog…) are rejected.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="content">Content</Label>
        <Textarea id="content" name="content" rows={16} defaultValue={page?.content ?? ""} />
        <p className="text-xs text-muted-foreground">
          Plain text. Leave a blank line between paragraphs.
        </p>
      </div>
      <StatusField defaultValue={page?.status ?? "draft"} />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : page ? "Save changes" : "Create page"}
      </Button>
    </form>
  );
}

export function FaqForm({
  faq,
  action,
}: {
  faq?: Faq;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const { isPending, error, handleSubmit } = useFormAction(
    action,
    faq ? "FAQ updated." : "FAQ created."
  );

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="question">Question</Label>
        <Input id="question" name="question" defaultValue={faq?.question} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="answer">Answer</Label>
        <Textarea id="answer" name="answer" rows={6} defaultValue={faq?.answer ?? ""} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category (optional)</Label>
          <Input id="category" name="category" defaultValue={faq?.category ?? ""} placeholder="Ordering" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sortOrder">Order (lower shows first)</Label>
          <Input id="sortOrder" name="sortOrder" type="number" defaultValue={faq?.sort_order ?? 0} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={faq?.is_active ?? true} className="size-4" />
        Active — visible on /faq
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : faq ? "Save changes" : "Create FAQ"}
      </Button>
    </form>
  );
}

export function OccasionForm({
  occasion,
  action,
}: {
  occasion?: Occasion;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const { isPending, error, handleSubmit } = useFormAction(
    action,
    occasion ? "Occasion updated." : "Occasion created."
  );

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={occasion?.name} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" defaultValue={occasion?.slug} placeholder="mehndi" required />
          <p className="text-xs text-muted-foreground">Used in /products?occasion=your-slug</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={occasion?.description ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="sortOrder">Order (lower shows first)</Label>
        <Input id="sortOrder" name="sortOrder" type="number" defaultValue={occasion?.sort_order ?? 0} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={occasion?.is_active ?? true} className="size-4" />
        Active — shown as a filter on the shop and understood by the assistant
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : occasion ? "Save changes" : "Create occasion"}
      </Button>
    </form>
  );
}

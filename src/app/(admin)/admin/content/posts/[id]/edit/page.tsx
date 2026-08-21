import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateBlogPost } from "@/features/admin-content/actions";
import { getAdminBlogPost } from "@/lib/admin/get-content";

import { BlogPostForm } from "../../../content-forms";

export const metadata: Metadata = { title: "Edit Post" };

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getAdminBlogPost(id);
  if (!post) notFound();

  return (
    <div className="container max-w-3xl py-10">
      <h1 className="mb-6 font-heading text-2xl">Edit Journal Post</h1>
      {/* Remount on save so Base UI inputs pick up the new defaultValue —
          see "Base UI Input: stale defaultValue" in docs/ARCHITECTURE.md. */}
      <BlogPostForm
        key={`${post.id}-${post.updated_at}`}
        post={post}
        action={updateBlogPost.bind(null, id)}
      />
    </div>
  );
}

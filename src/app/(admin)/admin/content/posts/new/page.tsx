import type { Metadata } from "next";

import { createBlogPost } from "@/features/admin-content/actions";

import { BlogPostForm } from "../../content-forms";

export const metadata: Metadata = { title: "New Post" };

export default function NewBlogPostPage() {
  return (
    <div className="container max-w-3xl py-10">
      <h1 className="mb-6 font-heading text-2xl">New Journal Post</h1>
      <BlogPostForm action={createBlogPost} />
    </div>
  );
}

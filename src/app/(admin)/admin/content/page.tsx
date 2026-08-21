import type { Metadata } from "next";
import Link from "next/link";

import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { deleteBlogPost, deleteFaq, deletePage } from "@/features/admin-content/actions";
import { getAdminBlogPosts, getAdminFaqs, getAdminPages } from "@/lib/admin/get-content";

export const metadata: Metadata = { title: "Content" };

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span className={published ? "text-foreground" : "text-muted-foreground"}>
      {published ? "Published" : "Draft"}
    </span>
  );
}

export default async function AdminContentPage() {
  const [posts, pages, faqs] = await Promise.all([
    getAdminBlogPosts(),
    getAdminPages(),
    getAdminFaqs(),
  ]);

  return (
    <div className="container flex flex-col gap-12 py-10">
      <div>
        <h1 className="font-heading text-2xl">Content Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Journal posts, site pages and FAQs. Drafts are invisible to the public and excluded from
          the sitemap.
        </p>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-xl">Journal Posts</h2>
          <Button render={<Link href="/admin/content/posts/new" />}>New Post</Button>
        </div>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">URL</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Published</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <Link href={`/admin/content/posts/${post.id}/edit`} className="hover:underline">
                        {post.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">/blog/{post.slug}</td>
                    <td className="px-4 py-2">
                      <StatusBadge published={post.status === "published"} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString("en-GB")
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <DeleteButton
                        action={deleteBlogPost.bind(null, post.id)}
                        confirmMessage="Delete this post?"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-xl">Site Pages</h2>
          <Button render={<Link href="/admin/content/pages/new" />}>New Page</Button>
        </div>
        {pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pages yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">URL</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <Link href={`/admin/content/pages/${page.id}/edit`} className="hover:underline">
                        {page.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">/{page.slug}</td>
                    <td className="px-4 py-2">
                      <StatusBadge published={page.status === "published"} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <DeleteButton
                        action={deletePage.bind(null, page.id)}
                        confirmMessage="Delete this page?"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-xl">FAQs</h2>
          <Button render={<Link href="/admin/content/faqs/new" />}>New FAQ</Button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Active FAQs render on /faq and power its FAQPage structured data.
        </p>
        {faqs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No FAQs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Question</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Active</th>
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {faqs.map((faq) => (
                  <tr key={faq.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <Link href={`/admin/content/faqs/${faq.id}/edit`} className="hover:underline">
                        {faq.question}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{faq.category ?? "General"}</td>
                    <td className="px-4 py-2">{faq.is_active ? "Yes" : "—"}</td>
                    <td className="px-4 py-2">{faq.sort_order}</td>
                    <td className="px-4 py-2 text-right">
                      <DeleteButton
                        action={deleteFaq.bind(null, faq.id)}
                        confirmMessage="Delete this FAQ?"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

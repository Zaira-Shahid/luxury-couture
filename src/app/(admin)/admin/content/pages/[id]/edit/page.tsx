import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updatePage } from "@/features/admin-content/actions";
import { getAdminPage } from "@/lib/admin/get-content";

import { PageForm } from "../../../content-forms";

export const metadata: Metadata = { title: "Edit Page" };

export default async function EditCmsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getAdminPage(id);
  if (!page) notFound();

  return (
    <div className="container max-w-3xl py-10">
      <h1 className="mb-6 font-heading text-2xl">Edit Site Page</h1>
      <PageForm key={`${page.id}-${page.updated_at}`} page={page} action={updatePage.bind(null, id)} />
    </div>
  );
}

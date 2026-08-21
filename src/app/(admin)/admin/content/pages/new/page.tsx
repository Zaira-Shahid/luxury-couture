import type { Metadata } from "next";

import { createPage } from "@/features/admin-content/actions";

import { PageForm } from "../../content-forms";

export const metadata: Metadata = { title: "New Page" };

export default function NewCmsPage() {
  return (
    <div className="container max-w-3xl py-10">
      <h1 className="mb-6 font-heading text-2xl">New Site Page</h1>
      <PageForm action={createPage} />
    </div>
  );
}

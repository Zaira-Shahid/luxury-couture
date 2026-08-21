import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateFaq } from "@/features/admin-content/actions";
import { getAdminFaq } from "@/lib/admin/get-content";

import { FaqForm } from "../../../content-forms";

export const metadata: Metadata = { title: "Edit FAQ" };

export default async function EditFaqPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const faq = await getAdminFaq(id);
  if (!faq) notFound();

  return (
    <div className="container max-w-3xl py-10">
      <h1 className="mb-6 font-heading text-2xl">Edit FAQ</h1>
      <FaqForm key={`${faq.id}-${faq.updated_at}`} faq={faq} action={updateFaq.bind(null, id)} />
    </div>
  );
}

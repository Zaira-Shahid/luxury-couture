import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateOccasion } from "@/features/admin-content/actions";
import { getAdminOccasion } from "@/lib/admin/get-content";

import { OccasionForm } from "../../../content-forms";

export const metadata: Metadata = { title: "Edit Occasion" };

export default async function EditOccasionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const occasion = await getAdminOccasion(id);
  if (!occasion) notFound();

  return (
    <div className="container max-w-3xl py-10">
      <h1 className="mb-6 font-heading text-2xl">Edit Occasion</h1>
      <OccasionForm
        key={`${occasion.id}-${occasion.updated_at}`}
        occasion={occasion}
        action={updateOccasion.bind(null, id)}
      />
    </div>
  );
}

import type { Metadata } from "next";

import { createOccasion } from "@/features/admin-content/actions";

import { OccasionForm } from "../../content-forms";

export const metadata: Metadata = { title: "New Occasion" };

export default function NewOccasionPage() {
  return (
    <div className="container max-w-3xl py-10">
      <h1 className="mb-6 font-heading text-2xl">New Occasion</h1>
      <OccasionForm action={createOccasion} />
    </div>
  );
}

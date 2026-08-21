import type { Metadata } from "next";

import { createFaq } from "@/features/admin-content/actions";

import { FaqForm } from "../../content-forms";

export const metadata: Metadata = { title: "New FAQ" };

export default function NewFaqPage() {
  return (
    <div className="container max-w-3xl py-10">
      <h1 className="mb-6 font-heading text-2xl">New FAQ</h1>
      <FaqForm action={createFaq} />
    </div>
  );
}

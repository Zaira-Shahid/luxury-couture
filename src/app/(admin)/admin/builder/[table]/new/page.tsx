import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createBuilderOption } from "@/features/admin-builder-options/actions";
import { isBuilderOptionTable } from "@/lib/admin/get-builder-options";

import { BuilderOptionForm } from "../builder-option-form";

export const metadata: Metadata = { title: "New Builder Option" };

export default async function NewBuilderOptionPage({ params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  if (!isBuilderOptionTable(table)) notFound();

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="mb-6 font-heading text-2xl">New Option</h1>
      <BuilderOptionForm table={table} action={createBuilderOption.bind(null, table)} />
    </div>
  );
}

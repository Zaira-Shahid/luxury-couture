import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateBuilderOption } from "@/features/admin-builder-options/actions";
import { getAdminOptionRow, isBuilderOptionTable } from "@/lib/admin/get-builder-options";
import type { Colour, Fabric } from "@/types/database";

import { BuilderOptionForm } from "../../builder-option-form";

export const metadata: Metadata = { title: "Edit Builder Option" };

export default async function EditBuilderOptionPage({
  params,
}: {
  params: Promise<{ table: string; id: string }>;
}) {
  const { table, id } = await params;
  if (!isBuilderOptionTable(table)) notFound();

  const option = await getAdminOptionRow<Fabric | Colour>(table, id);
  if (!option) notFound();

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="mb-6 font-heading text-2xl">Edit Option</h1>
      <BuilderOptionForm
        key={`${option.id}-${option.updated_at}`}
        table={table}
        option={option}
        action={updateBuilderOption.bind(null, table, id)}
      />
    </div>
  );
}

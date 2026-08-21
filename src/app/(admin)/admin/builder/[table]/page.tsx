import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { deleteBuilderOption } from "@/features/admin-builder-options/actions";
import { getAdminOptionRows, isBuilderOptionTable } from "@/lib/admin/get-builder-options";
import type { BuilderOptionTable, Colour, Fabric } from "@/types/database";

const TABLE_LABELS: Record<BuilderOptionTable, string> = {
  fabrics: "Fabrics",
  embroidery_types: "Embroidery Types",
  colours: "Colours",
  sleeve_styles: "Sleeve Styles",
  necklines: "Necklines",
  dupatta_options: "Dupatta Options",
};

export async function generateMetadata({ params }: { params: Promise<{ table: string }> }): Promise<Metadata> {
  const { table } = await params;
  return { title: isBuilderOptionTable(table) ? TABLE_LABELS[table] : "Builder" };
}

export default async function AdminBuilderOptionsPage({ params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  if (!isBuilderOptionTable(table)) notFound();

  const options = await getAdminOptionRows<Fabric | Colour>(table);

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl">{TABLE_LABELS[table]}</h1>
        <Button render={<Link href={`/admin/builder/${table}/new`} />}>New</Button>
      </div>

      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">No options yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Price adjustment</th>
                <th className="px-4 py-2 font-medium">Active</th>
                <th className="px-4 py-2 font-medium">Sort</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {options.map((option) => (
                <tr key={option.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/admin/builder/${table}/${option.id}/edit`} className="hover:underline">
                      {option.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">£{Number(option.price_adjustment).toFixed(2)}</td>
                  <td className="px-4 py-2">{option.is_active ? "Yes" : "—"}</td>
                  <td className="px-4 py-2">{option.sort_order}</td>
                  <td className="px-4 py-2 text-right">
                    <DeleteButton
                      action={deleteBuilderOption.bind(null, table, option.id)}
                      confirmMessage="Delete this option?"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

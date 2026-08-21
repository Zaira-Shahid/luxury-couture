import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminOptionRows } from "@/lib/admin/get-builder-options";
import { BUILDER_OPTION_TABLES, type BuilderOptionTable } from "@/types/database";

export const metadata: Metadata = { title: "Builder" };

const TABLE_LABELS: Record<BuilderOptionTable, string> = {
  fabrics: "Fabrics",
  embroidery_types: "Embroidery Types",
  colours: "Colours",
  sleeve_styles: "Sleeve Styles",
  necklines: "Necklines",
  dupatta_options: "Dupatta Options",
};

export default async function AdminBuilderPage() {
  const counts = await Promise.all(
    BUILDER_OPTION_TABLES.map(async (table) => ({
      table,
      count: (await getAdminOptionRows(table)).length,
    }))
  );

  return (
    <div className="container py-10">
      <h1 className="mb-6 font-heading text-2xl">Builder</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {counts.map(({ table, count }) => (
          <Link key={table} href={`/admin/builder/${table}`} className="block">
            <Card className="h-full transition-colors hover:border-foreground/20">
              <CardHeader>
                <CardTitle className="text-base">{TABLE_LABELS[table]}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{count} options</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

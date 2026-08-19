import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  getMeasurementFieldDefinitions,
  groupFieldsByCategory,
} from "@/lib/measurements/get-field-definitions";
import { getMeasurementProfile } from "@/lib/measurements/get-profiles";

import { AdminActions } from "./admin-actions";

export const metadata: Metadata = { title: "Measurement Profile" };

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted for review",
  approved: "Approved",
  correction_requested: "Correction requested",
};

export default async function AdminMeasurementProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, fields] = await Promise.all([
    getMeasurementProfile(id),
    getMeasurementFieldDefinitions(),
  ]);

  if (!result) notFound();
  const { profile, values } = result;

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", profile.customer_id)
    .single();

  const groups = groupFieldsByCategory(fields);

  return (
    <div className="container flex flex-col gap-6 py-10">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>{profile.label}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {customer?.full_name ?? "Unnamed customer"} · {profile.unit} ·{" "}
              {STATUS_LABELS[profile.status] ?? profile.status}
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {profile.notes ? (
            <p className="text-sm">
              <strong>Customer notes:</strong> {profile.notes}
            </p>
          ) : null}
          {profile.admin_notes ? (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <strong>Correction requested:</strong> {profile.admin_notes}
            </p>
          ) : null}
          <AdminActions profileId={profile.id} />
        </CardContent>
      </Card>

      {groups.map((group) => (
        <Card key={group.category}>
          <CardHeader>
            <CardTitle className="text-base">{group.category}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {group.items.map((field) => (
              <div key={field.key} className="flex justify-between border-b border-border pb-2 text-sm">
                <span className="text-muted-foreground">{field.label}</span>
                <span>{values[field.key] !== undefined ? `${values[field.key]} ${profile.unit}` : "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { groupFieldsByCategory, getMeasurementFieldDefinitions } from "@/lib/measurements/get-field-definitions";
import { getMeasurementProfile } from "@/lib/measurements/get-profiles";

import { MeasurementForm } from "./measurement-form";

export const metadata: Metadata = { title: "Edit Measurements" };

export default async function EditMeasurementProfilePage({
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

  const groups = groupFieldsByCategory(fields);

  return (
    <MeasurementForm
      key={`${result.profile.id}-${result.profile.updated_at}`}
      profile={result.profile}
      values={result.values}
      groups={groups}
    />
  );
}

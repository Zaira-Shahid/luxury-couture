"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveProfile, submitProfile } from "@/features/measurements/actions";
import type { MeasurementFieldDefinition, MeasurementProfile } from "@/types/database";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted for review",
  approved: "Approved",
  correction_requested: "Correction requested",
};

export function MeasurementForm({
  profile,
  values,
  groups,
}: {
  profile: MeasurementProfile;
  values: Record<string, number>;
  groups: { category: string; items: MeasurementFieldDefinition[] }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSaving, startSaving] = useTransition();
  const [isSubmitting, startSubmitting] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!formRef.current) return;
    setError(null);
    const formData = new FormData(formRef.current);
    startSaving(async () => {
      const result = await saveProfile(profile.id, formData);
      if ("error" in result) setError(result.error);
      else toast.success("Saved.");
    });
  }

  function handleSubmitForReview() {
    if (!formRef.current) return;
    setError(null);
    const formData = new FormData(formRef.current);
    startSubmitting(async () => {
      const saveResult = await saveProfile(profile.id, formData);
      if ("error" in saveResult) {
        setError(saveResult.error);
        return;
      }
      const submitResult = await submitProfile(profile.id);
      if ("error" in submitResult) setError(submitResult.error);
      else toast.success("Submitted for review.");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{profile.label}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {STATUS_LABELS[profile.status] ?? profile.status}
          </span>
        </CardHeader>
        {profile.status === "correction_requested" && profile.admin_notes ? (
          <CardContent>
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <strong>Correction requested:</strong> {profile.admin_notes}
            </p>
          </CardContent>
        ) : null}
      </Card>

      <form ref={formRef} className="flex flex-col gap-8">
        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="label">Profile name</Label>
              <Input id="label" name="label" defaultValue={profile.label} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit">Unit</Label>
              <select
                id="unit"
                name="unit"
                defaultValue={profile.unit}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="cm">Centimetres</option>
                <option value="inch">Inches</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" name="notes" rows={2} defaultValue={profile.notes ?? ""} />
            </div>
          </CardContent>
        </Card>

        {groups.map((group) => (
          <Card key={group.category}>
            <CardHeader>
              <CardTitle className="text-base">{group.category}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {group.items.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`field_${field.key}`}>
                    {field.label}
                    {field.is_required ? <span className="text-destructive"> *</span> : null}
                  </Label>
                  <Input
                    id={`field_${field.key}`}
                    name={`field_${field.key}`}
                    type="number"
                    step="0.1"
                    min="0"
                    defaultValue={values[field.key] ?? ""}
                  />
                  {field.description ? (
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={isSaving || isSubmitting} onClick={handleSave}>
            {isSaving ? "Saving…" : "Save Draft"}
          </Button>
          <Button type="button" disabled={isSaving || isSubmitting} onClick={handleSubmitForReview}>
            {isSubmitting ? "Submitting…" : "Submit for Review"}
          </Button>
        </div>
      </form>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMeasurementProfiles } from "@/lib/measurements/get-profiles";

import { DeleteProfileButton } from "./delete-profile-button";
import { NewProfileButton } from "./new-profile-button";

export const metadata: Metadata = { title: "Measurements" };

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted for review",
  approved: "Approved",
  correction_requested: "Correction requested",
};

export default async function MeasurementsPage() {
  const profiles = await getMeasurementProfiles();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Measurement Profiles</CardTitle>
            <CardDescription>
              Save your measurements for a perfect fit.{" "}
              <Link href="/account/measurements/guide" className="text-primary underline-offset-4 hover:underline">
                View the measurement guide
              </Link>
              .
            </CardDescription>
          </div>
          <NewProfileButton />
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No measurement profiles yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {profiles.map((profile) => (
                <li
                  key={profile.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
                >
                  <Link href={`/account/measurements/${profile.id}/edit`} className="text-sm">
                    <p className="font-medium">{profile.label}</p>
                    <p className="text-muted-foreground">
                      {STATUS_LABELS[profile.status] ?? profile.status} · {profile.unit}
                    </p>
                    {profile.status === "correction_requested" && profile.admin_notes ? (
                      <p className="mt-1 text-xs text-destructive">{profile.admin_notes}</p>
                    ) : null}
                  </Link>
                  <DeleteProfileButton profileId={profile.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { getAdminMeasurementProfiles } from "@/lib/measurements/get-admin-profiles";
import type { MeasurementProfileStatus } from "@/types/database";

export const metadata: Metadata = { title: "Measurements" };

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  correction_requested: "Correction requested",
};

const STATUSES: MeasurementProfileStatus[] = ["submitted", "correction_requested", "approved", "draft"];

export default async function AdminMeasurementsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus =
    status && STATUSES.includes(status as MeasurementProfileStatus)
      ? (status as MeasurementProfileStatus)
      : undefined;
  const profiles = await getAdminMeasurementProfiles(activeStatus);

  return (
    <div className="container py-10">
      <h1 className="font-heading text-2xl">Measurements</h1>

      <div className="mt-4 flex gap-2 text-sm">
        <Link
          href="/admin/measurements"
          className={!activeStatus ? "font-medium text-foreground" : "text-muted-foreground"}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/measurements?status=${s}`}
            className={activeStatus === s ? "font-medium text-foreground" : "text-muted-foreground"}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Profile</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No measurement profiles found.
                </td>
              </tr>
            ) : (
              profiles.map((profile) => (
                <tr key={profile.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/measurements/${profile.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {profile.profiles?.full_name ?? "Unnamed customer"}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{profile.label}</td>
                  <td className="px-4 py-2">{STATUS_LABELS[profile.status] ?? profile.status}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(profile.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

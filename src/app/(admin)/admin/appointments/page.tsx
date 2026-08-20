import type { Metadata } from "next";
import Link from "next/link";

import { getAdminAppointments } from "@/lib/consultations/get-admin-appointments";
import type { AppointmentStatus } from "@/types/database";

export const metadata: Metadata = { title: "Appointments" };

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

const STATUSES: AppointmentStatus[] = ["requested", "confirmed", "completed", "cancelled", "no_show"];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
}

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus =
    status && STATUSES.includes(status as AppointmentStatus) ? (status as AppointmentStatus) : undefined;
  const appointments = await getAdminAppointments(activeStatus);

  return (
    <div className="container py-10">
      <h1 className="font-heading text-2xl">Appointments</h1>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/appointments"
          className={!activeStatus ? "font-medium text-foreground" : "text-muted-foreground"}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/appointments?status=${s}`}
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
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  No appointments found.
                </td>
              </tr>
            ) : (
              appointments.map((appointment) => (
                <tr key={appointment.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/appointments/${appointment.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {appointment.contact_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{appointment.contact_email}</p>
                  </td>
                  <td className="px-4 py-2">{formatDateTime(appointment.scheduled_at)}</td>
                  <td className="px-4 py-2">{STATUS_LABELS[appointment.status] ?? appointment.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

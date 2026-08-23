import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyAppointments } from "@/lib/consultations/get-appointments";

import { CancelAppointmentButton } from "./cancel-appointment-button";

export const metadata: Metadata = { title: "Consultations" };

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export default async function ConsultationsPage() {
  const appointments = await getMyAppointments();

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Consultations</CardTitle>
        <CardDescription>
          Your styling appointments and enquiries.{" "}
          <Link href="/consultations" className="text-primary underline-offset-4 hover:underline">
            Book a new consultation
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No consultations booked yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {appointments.map((appointment) => (
              <li
                key={appointment.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{formatDateTime(appointment.scheduled_at)}</p>
                  <p className="text-muted-foreground">
                    {STATUS_LABELS[appointment.status] ?? appointment.status}
                  </p>
                </div>
                {appointment.status === "requested" || appointment.status === "confirmed" ? (
                  <CancelAppointmentButton appointmentId={appointment.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

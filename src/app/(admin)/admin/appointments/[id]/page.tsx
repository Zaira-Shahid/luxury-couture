import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminAppointment } from "@/lib/consultations/get-admin-appointments";
import { createClient } from "@/lib/supabase/server";

import { AppointmentActions } from "./appointment-actions";

export const metadata: Metadata = { title: "Appointment" };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "UTC" });
}

export default async function AdminAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appointment = await getAdminAppointment(id);
  if (!appointment) notFound();

  let consultationTypeName: string | null = null;
  if (appointment.consultation_type_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("consultation_types")
      .select("name")
      .eq("id", appointment.consultation_type_id)
      .single();
    consultationTypeName = data?.name ?? null;
  }

  return (
    <div className="container flex flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{appointment.contact_name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {appointment.contact_email}
            {appointment.contact_phone ? ` · ${appointment.contact_phone}` : ""}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">
            <strong>{formatDateTime(appointment.scheduled_at)}</strong> ({appointment.duration_minutes} min)
          </p>
          {consultationTypeName ? <p className="text-sm">{consultationTypeName}</p> : null}
          {appointment.notes ? (
            <p className="text-sm text-muted-foreground">{appointment.notes}</p>
          ) : null}
          <AppointmentActions appointmentId={appointment.id} currentStatus={appointment.status} />
        </CardContent>
      </Card>
    </div>
  );
}

import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getConsultationTypes } from "@/lib/consultations/get-types";
import { buildMetadata } from "@/lib/seo/build-metadata";

import { BookingForm } from "./booking-form";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Book a Consultation",
    description:
      "Sit down with our design team to plan your bespoke lehenga — in person or virtually.",
    path: "/consultations",
  });
}

export default async function ConsultationsPage() {
  const consultationTypes = await getConsultationTypes();

  return (
    <div className="container max-w-xl py-16">
      <Card>
        <CardHeader>
          <CardTitle>Book a Consultation</CardTitle>
          <CardDescription>
            Sit down with our design team to plan your bespoke piece — in person or virtually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {consultationTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Booking isn&apos;t available right now — please use the contact form instead.
            </p>
          ) : (
            <BookingForm consultationTypes={consultationTypes} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

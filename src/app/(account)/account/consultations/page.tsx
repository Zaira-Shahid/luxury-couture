import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Consultations" };

export default function ConsultationsPage() {
  return (
    <ComingSoon
      title="Consultations"
      description="Manage your styling appointments and enquiries."
    />
  );
}

import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Measurements" };

export default function MeasurementsPage() {
  return (
    <ComingSoon
      title="Measurements"
      description="Save your measurement profiles for a perfect fit."
    />
  );
}

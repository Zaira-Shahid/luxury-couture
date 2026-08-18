import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
  return <ComingSoon title="Payments" description="Your payment history and receipts." />;
}

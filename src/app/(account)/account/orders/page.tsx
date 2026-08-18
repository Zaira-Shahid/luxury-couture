import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return <ComingSoon title="Orders" description="Track your custom orders here." />;
}

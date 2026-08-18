import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return <ComingSoon title="Notifications" description="Updates about your orders and account." />;
}

import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Analytics" };

export default function AdminAnalyticsPage() {
  return (
    <div className="container py-10">
      <ComingSoon
        title="Analytics & Tracking"
        description="Full reporting and event tracking — Module 21. See the Dashboard for a quick overview in the meantime."
      />
    </div>
  );
}

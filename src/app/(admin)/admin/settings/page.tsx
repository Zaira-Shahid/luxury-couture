import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return (
    <div className="container py-10">
      <ComingSoon
        title="Admin Settings & Business Configuration"
        description="General, theme, and store configuration — Module 25."
      />
    </div>
  );
}

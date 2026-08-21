import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Content" };

export default function AdminContentPage() {
  return (
    <div className="container py-10">
      <ComingSoon title="Content Management" description="Manage site pages and content — Module 20." />
    </div>
  );
}

import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "SEO" };

export default function AdminSeoPage() {
  return (
    <div className="container py-10">
      <ComingSoon title="SEO" description="Site-wide SEO controls — Module 20." />
    </div>
  );
}

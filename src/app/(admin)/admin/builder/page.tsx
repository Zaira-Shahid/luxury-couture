import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Builder" };

export default function AdminBuilderPage() {
  return (
    <div className="container py-10">
      <ComingSoon
        title="Builder Management"
        description="Manage fabrics, colours, embroidery types, silhouettes, and builder pricing — Module 17."
      />
    </div>
  );
}

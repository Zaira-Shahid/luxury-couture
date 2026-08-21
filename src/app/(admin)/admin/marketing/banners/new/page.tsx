import type { Metadata } from "next";

import { createBanner } from "@/features/admin-banners/actions";

import { BannerForm } from "../banner-form";

export const metadata: Metadata = { title: "New Banner" };

export default function NewBannerPage() {
  return (
    <div className="container max-w-2xl py-10">
      <h1 className="mb-6 font-heading text-2xl">New Banner</h1>
      <BannerForm action={createBanner} />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateBanner } from "@/features/admin-banners/actions";
import { getAdminBanner } from "@/lib/admin/get-banners";

import { BannerForm } from "../../banner-form";

export const metadata: Metadata = { title: "Edit Banner" };

export default async function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const banner = await getAdminBanner(id);
  if (!banner) notFound();

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="mb-6 font-heading text-2xl">Edit Banner</h1>
      <BannerForm key={`${banner.id}-${banner.updated_at}`} banner={banner} action={updateBanner.bind(null, id)} />
    </div>
  );
}

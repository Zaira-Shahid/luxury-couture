import type { Metadata } from "next";
import Link from "next/link";

import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { deleteBanner } from "@/features/admin-banners/actions";
import { getAdminBanners } from "@/lib/admin/get-banners";

export const metadata: Metadata = { title: "Promotional Banners" };

export default async function AdminBannersPage() {
  const banners = await getAdminBanners();

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl">Promotional Banners</h1>
        <Button render={<Link href="/admin/marketing/banners/new" />}>New Banner</Button>
      </div>

      {banners.length === 0 ? (
        <p className="text-sm text-muted-foreground">No banners yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Text</th>
                <th className="px-4 py-2 font-medium">Active</th>
                <th className="px-4 py-2 font-medium">Schedule</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => (
                <tr key={banner.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/admin/marketing/banners/${banner.id}/edit`} className="hover:underline">
                      {banner.text}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{banner.is_active ? "Yes" : "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {banner.starts_at ? new Date(banner.starts_at).toLocaleDateString("en-GB") : "Always"}
                    {banner.expires_at ? ` – ${new Date(banner.expires_at).toLocaleDateString("en-GB")}` : ""}
                  </td>
                  <td className="px-4 py-2">{banner.sort_order}</td>
                  <td className="px-4 py-2 text-right">
                    <DeleteButton action={deleteBanner.bind(null, banner.id)} confirmMessage="Delete this banner?" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

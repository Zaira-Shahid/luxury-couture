import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { getProfile, isStaffRole } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Middleware already gates /admin by role, but Server Components render
  // independently of it — check again here rather than assume.
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/admin");
  if (!isStaffRole(profile.role)) redirect("/");

  return (
    <div className="flex min-h-screen bg-muted/30">
      <AdminSidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <AdminTopbar profile={profile} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

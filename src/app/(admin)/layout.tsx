import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { getMyPermissions, getProfile, isStaffRole } from "@/lib/auth/session";

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

  // Module 26: resolved once here and passed down, so the sidebar only
  // offers what this role can actually use. Cosmetic — every admin route
  // guards itself and RLS sits underneath both.
  const permissions = [...(await getMyPermissions())];

  return (
    <div className="flex min-h-screen bg-muted/30">
      <AdminSidebar permissions={permissions} />
      <div className="flex min-h-screen flex-1 flex-col">
        <AdminTopbar profile={profile} permissions={permissions} />
        <main id="main-content" className="flex-1">{children}</main>
      </div>
    </div>
  );
}

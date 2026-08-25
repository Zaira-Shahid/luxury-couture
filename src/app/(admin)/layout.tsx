import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { getMyPermissions, getProfile, isStaffRole } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

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
  const settings = await getSiteSettings();
  const backdrop = settings.branding.adminBackgroundUrl;

  return (
    <div className="relative flex min-h-screen bg-muted/30">
      {/*
        Decorative backdrop, deliberately faint.

        The admin is a working tool — dense tables, small numbers, long
        order IDs — and Module 28's contrast pass is what makes that
        readable. A full-strength photograph behind it would undo that
        work on every screen at once. So the image sits at low opacity
        UNDER a near-opaque scrim in the page's own background colour,
        which means the effective text/background contrast is essentially
        unchanged from the plain layout.

        `fixed` rather than `absolute`: the sidebar scrolls independently
        and a scrolling backdrop behind a long orders table is a
        distraction. aria-hidden and pointer-events-none because it
        carries no meaning and must never intercept a click.
      */}
      {backdrop ? (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-[0.18]"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
          <div className="absolute inset-0 bg-background/90" />
        </div>
      ) : null}
      <AdminSidebar permissions={permissions} />
      <div className="flex min-h-screen flex-1 flex-col">
        <AdminTopbar profile={profile} permissions={permissions} />
        <main id="main-content" className="flex-1">{children}</main>
      </div>
    </div>
  );
}

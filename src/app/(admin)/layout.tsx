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
          {/*
            ONE dimming layer, not two.

            This was opacity 0.30 behind an additional bg-background/88
            scrim, which multiplies: 0.30 x (1 - 0.88) left about 3.6% of
            the image showing. It was technically painted and effectively
            invisible.

            A single opacity is used instead so the number means what it
            says.

            The owner asked for it to run behind the WHOLE admin, sidebar
            included, so the sidebar and topbar were dropped to 75% with a
            backdrop-blur. Those two are the only surfaces where text sits
            straight on the backdrop; everything else on a dashboard page
            is inside an opaque bg-card, so no figure or table row is ever
            read against the photograph. The blur is what keeps a busy
            patch of it from fighting the nav labels.
          */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-[0.45]"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
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

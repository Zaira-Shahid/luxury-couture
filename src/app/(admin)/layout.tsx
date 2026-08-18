import { redirect } from "next/navigation";

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

  return <div className="min-h-screen bg-muted/30">{children}</div>;
}

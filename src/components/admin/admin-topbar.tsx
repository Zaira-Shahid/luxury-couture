import Link from "next/link";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { ROLE_LABELS, type AppRole } from "@/lib/auth/permissions";
import { siteConfig } from "@/lib/config/site";
import type { Profile } from "@/types/database";

import { AdminMobileNav } from "./admin-mobile-nav";

export function AdminTopbar({
  profile,
  permissions,
}: {
  profile: Profile | null;
  permissions: string[];
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/75 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <AdminMobileNav permissions={permissions} />
        <Link href="/admin" className="font-heading text-base tracking-wide">
          {siteConfig.name}
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {profile?.full_name ?? "Staff"} ·{" "}
          {profile ? (ROLE_LABELS[profile.role as AppRole] ?? profile.role) : ""}
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}

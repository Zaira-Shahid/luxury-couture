import Link from "next/link";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { siteConfig } from "@/lib/config/site";
import type { Profile } from "@/types/database";

import { AdminMobileNav } from "./admin-mobile-nav";

export function AdminTopbar({ profile }: { profile: Profile | null }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <AdminMobileNav />
        <Link href="/admin" className="font-heading text-base tracking-wide">
          {siteConfig.name}
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {profile?.full_name ?? "Staff"} · {profile?.role}
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}

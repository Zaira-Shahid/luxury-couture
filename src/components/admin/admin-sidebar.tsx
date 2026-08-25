"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { navGroupsFor } from "./admin-nav-items";

export function AdminSidebarNav({
  onNavigate,
  permissions,
}: {
  onNavigate?: () => void;
  /**
   * Module 26: resolved server-side from the signed-in user. Filtering
   * here is COSMETIC — it keeps a Finance user from being shown a
   * Production menu they cannot use. The real enforcement is the route
   * guard and RLS, per the plan's "never rely only on hiding UI buttons".
   */
  permissions: string[];
}) {
  const pathname = usePathname();
  const groups = navGroupsFor(new Set(permissions));

  return (
    <nav className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">
            {group.label}
          </p>
          {group.items.map((item) => {
            const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{item.label}</span>
                {item.comingSoon ? (
                  <span className="ml-auto shrink-0 text-[10px] text-sidebar-foreground/40">Soon</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AdminSidebar({ permissions }: { permissions: string[] }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar/75 px-3 py-6 backdrop-blur-md md:block">
      <AdminSidebarNav permissions={permissions} />
    </aside>
  );
}

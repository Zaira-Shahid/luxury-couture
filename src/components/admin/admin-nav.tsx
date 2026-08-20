"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// Minimal nav for the pages that exist today. Module 16 ("Admin Dashboard
// Foundation") replaces this with the full premium dashboard shell/nav
// covering every admin area — this isn't trying to anticipate that.
const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/collections", label: "Collections" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/measurements", label: "Measurements" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/enquiries", label: "Enquiries" },
  { href: "/admin/appointments", label: "Appointments" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-background px-4 py-2">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/account", label: "Profile" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/quotations", label: "Quotations" },
  { href: "/account/measurements", label: "Measurements" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/consultations", label: "Consultations" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/payments", label: "Payments" },
  { href: "/account/loyalty", label: "Loyalty" },
  { href: "/account/referrals", label: "Referrals" },
] as const;

export function AccountNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
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
            {item.href === "/account/notifications" && unreadCount > 0 ? (
              <span
                className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 py-0.5 text-xs font-medium text-background"
                aria-label={`${unreadCount} unread`}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

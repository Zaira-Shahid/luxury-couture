import type { Permission } from "@/lib/auth/permissions";
import {
  BarChart3,
  Boxes,
  Calendar,
  CreditCard,
  Factory,
  FileEdit,
  FileText,
  Image,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  Package,
  Ruler,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  Tags,
  Truck,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Not built yet — points at a ComingSoon placeholder, labeled with the module that owns it. */
  comingSoon?: boolean;
  /**
   * Module 26: the permission needed to see this item. Omitted means
   * every admin role sees it (the dashboard).
   *
   * HIDING IS COSMETIC ONLY. The Master Build Plan is explicit — "never
   * rely only on hiding UI buttons" — so the real enforcement is the
   * route guard plus RLS underneath. This exists so a Finance user is
   * not presented with a Production menu they cannot use.
   */
  permission?: Permission;
};

export type AdminNavGroup = { label: string; items: AdminNavItem[] };

/** Filters the nav for one user's permission set. Cosmetic — see AdminNavItem.permission. */
export function navGroupsFor(permissions: Set<string>): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || permissions.has(item.permission)),
  })).filter((group) => group.items.length > 0);
}

// Module 16 is the shell + Dashboard/Customers/Quotations — everything
// else already has a real page from Modules 5-14, or is explicitly owned
// by a later module (see docs/ARCHITECTURE.md's Module 16 section) and
// gets a ComingSoon placeholder instead of being built early.
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: Package, permission: "orders.read" },
      { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers.read" },
      { href: "/admin/quotations", label: "Quotations", icon: FileText, permission: "quotations.read" },
      { href: "/admin/payments", label: "Payments", icon: CreditCard, permission: "payments.read" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox, permission: "enquiries.read" },
      { href: "/admin/appointments", label: "Appointments", icon: Calendar, permission: "enquiries.read" },
      { href: "/admin/production", label: "Production", icon: Factory, permission: "production.read" },
      { href: "/admin/shipping", label: "Shipping", icon: Truck, permission: "shipping.write" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: ShoppingBag, permission: "catalog.read" },
      { href: "/admin/collections", label: "Collections", icon: LayoutGrid, permission: "catalog.read" },
      { href: "/admin/categories", label: "Categories", icon: Tags, permission: "catalog.read" },
      { href: "/admin/measurements", label: "Measurements", icon: Ruler, permission: "orders.read" },
      { href: "/admin/media", label: "Media", icon: Image, permission: "catalog.read" },
      { href: "/admin/builder", label: "Builder", icon: Wand2, permission: "catalog.read" },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes, permission: "inventory.write" },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/admin/reviews", label: "Reviews", icon: Star, permission: "reviews.moderate" },
      { href: "/admin/marketing", label: "Marketing", icon: Megaphone, permission: "marketing.write" },
      { href: "/admin/content", label: "Content", icon: FileEdit, permission: "content.write" },
      { href: "/admin/seo", label: "SEO", icon: Search, permission: "content.write" },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3, permission: "analytics.read" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings.manage" },
      { href: "/admin/team", label: "Team & Roles", icon: ShieldCheck, permission: "roles.manage" },
    ],
  },
];

import { permissionForAdminPath } from "@/lib/auth/permissions";
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
};

export type AdminNavGroup = { label: string; items: AdminNavItem[] };

/**
 * Filters the nav for one user’s permission set. Hiding is COSMETIC —
 * the Master Build Plan is explicit that a hidden button is never the
 * enforcement; the middleware route guard and RLS are.
 *
 * The requirement is read from permissionForAdminPath rather than from
 * the item, so the sidebar and the middleware route guard cannot disagree
 * about what a screen needs: a menu entry that stays visible after its
 * route starts refusing is exactly the drift this avoids.
 */
export function navGroupsFor(permissions: Set<string>): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const required = permissionForAdminPath(item.href);
      return !required || permissions.has(required);
    }),
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
      { href: "/admin/orders", label: "Orders", icon: Package },
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/quotations", label: "Quotations", icon: FileText },
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox },
      { href: "/admin/appointments", label: "Appointments", icon: Calendar },
      { href: "/admin/production", label: "Production", icon: Factory },
      { href: "/admin/shipping", label: "Shipping", icon: Truck },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: ShoppingBag },
      { href: "/admin/collections", label: "Collections", icon: LayoutGrid },
      { href: "/admin/categories", label: "Categories", icon: Tags },
      { href: "/admin/measurements", label: "Measurements", icon: Ruler },
      { href: "/admin/media", label: "Media", icon: Image },
      { href: "/admin/builder", label: "Builder", icon: Wand2 },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/admin/reviews", label: "Reviews", icon: Star },
      { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
      { href: "/admin/content", label: "Content", icon: FileEdit },
      { href: "/admin/seo", label: "SEO", icon: Search },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/team", label: "Team & Roles", icon: ShieldCheck },
    ],
  },
];

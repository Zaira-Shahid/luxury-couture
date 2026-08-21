import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Address, LoyaltyAccount, Order, Profile, Quotation, Referral } from "@/types/database";

export type AdminCustomer = Profile & { orderCount: number; lifetimeSpend: number; lastOrderAt: string | null };

/**
 * Every signed-up customer, with a lightweight order count/lifetime spend/
 * last-order-date computed in memory from all orders — acceptable for a
 * boutique business at this scale; a real "top customers" report belongs
 * to Module 21 (Analytics & Tracking), not this foundation module. This
 * is also the exact aggregate lib/admin/customer-segments.ts (Module 19
 * Pass 2) computes its VIP/New/At-risk tags from, rather than re-deriving
 * order data a second way.
 */
export async function getAdminCustomers(): Promise<AdminCustomer[]> {
  const supabase = await createClient();
  const [{ data: profiles, error: profilesError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "customer").order("created_at", { ascending: false }),
    supabase.from("orders").select("customer_id, total_amount, created_at"),
  ]);

  if (profilesError) {
    logger.warn("failed to load admin customers", { message: profilesError.message });
    return [];
  }
  if (ordersError) logger.warn("failed to load orders for customer stats", { message: ordersError.message });

  const byCustomer = new Map<string, { orderCount: number; lifetimeSpend: number; lastOrderAt: string | null }>();
  for (const order of (orders ?? []) as Pick<Order, "customer_id" | "total_amount" | "created_at">[]) {
    const existing = byCustomer.get(order.customer_id) ?? { orderCount: 0, lifetimeSpend: 0, lastOrderAt: null };
    existing.orderCount += 1;
    existing.lifetimeSpend += Number(order.total_amount);
    if (!existing.lastOrderAt || order.created_at > existing.lastOrderAt) existing.lastOrderAt = order.created_at;
    byCustomer.set(order.customer_id, existing);
  }

  return ((profiles ?? []) as Profile[]).map((profile) => ({
    ...profile,
    orderCount: byCustomer.get(profile.id)?.orderCount ?? 0,
    lifetimeSpend: byCustomer.get(profile.id)?.lifetimeSpend ?? 0,
    lastOrderAt: byCustomer.get(profile.id)?.lastOrderAt ?? null,
  }));
}

export type AdminCustomerDetail = {
  profile: Profile;
  email: string | null;
  orders: Order[];
  quotations: Quotation[];
  addresses: Address[];
  loyaltyAccount: LoyaltyAccount | null;
  referrals: Referral[];
};

/**
 * Email lives in auth.users, not profiles — fetched here (detail page
 * only, not the list) via the service-role client, the same narrow,
 * read-only elevation pattern used elsewhere in this project for data
 * regular RLS-respecting queries can't reach.
 */
export async function getAdminCustomerDetail(id: string): Promise<AdminCustomerDetail | null> {
  const supabase = await createClient();
  const [profileResult, ordersResult, quotationsResult, addressesResult, loyaltyResult, referralsResult] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).eq("role", "customer").single(),
      supabase.from("orders").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      supabase.from("quotations").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      supabase.from("addresses").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      supabase.from("loyalty_accounts").select("*").eq("customer_id", id).maybeSingle(),
      supabase.from("referrals").select("*").eq("referrer_customer_id", id).order("created_at", { ascending: false }),
    ]);
  if (profileResult.error || !profileResult.data) return null;

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(id);

  return {
    profile: profileResult.data as Profile,
    email: authUser?.user?.email ?? null,
    orders: (ordersResult.data ?? []) as Order[],
    quotations: (quotationsResult.data ?? []) as Quotation[],
    addresses: (addressesResult.data ?? []) as Address[],
    loyaltyAccount: (loyaltyResult.data ?? null) as LoyaltyAccount | null,
    referrals: (referralsResult.data ?? []) as Referral[],
  };
}

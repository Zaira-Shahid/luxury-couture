import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminCustomerDetail } from "@/lib/admin/get-customers";

import { AdjustLoyaltyForm } from "./adjust-loyalty-form";
import { CompleteReferralForm } from "./complete-referral-form";

export const metadata: Metadata = { title: "Customer" };

const REFERRAL_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  in_production: "In Production",
  ready_to_ship: "Ready to Ship",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting customer approval",
  accepted: "Accepted",
  rejected: "Declined",
  expired: "Expired",
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getAdminCustomerDetail(id);
  if (!detail) notFound();

  const { profile, email, orders, quotations, addresses, loyaltyAccount, referrals } = detail;

  return (
    <div className="container flex flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{profile.full_name ?? "Unnamed customer"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {email ?? "No email on file"}
            {profile.phone ? ` · ${profile.phone}` : ""}
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Joined {formatDate(profile.created_at)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border p-2 hover:border-foreground/30"
                  >
                    <span>{order.order_number}</span>
                    <span className="text-muted-foreground">
                      {formatPrice(order.total_amount, order.currency)} ·{" "}
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quotations</CardTitle>
        </CardHeader>
        <CardContent>
          {quotations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quotations yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {quotations.map((quotation) => (
                <li key={quotation.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-2">
                  <span>{formatPrice(quotation.quoted_price, quotation.currency)}</span>
                  <span className="text-muted-foreground">
                    {QUOTATION_STATUS_LABELS[quotation.status] ?? quotation.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {addresses.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Addresses</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {addresses.map((address) => (
                <li key={address.id}>
                  {address.recipient_name}, {address.line1}, {address.city} {address.postal_code}, {address.country}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loyalty Points</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            Balance: <span className="font-medium">{loyaltyAccount?.points_balance ?? 0}</span>
          </p>
          <AdjustLoyaltyForm customerId={profile.id} />
        </CardContent>
      </Card>

      {referrals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm">
              {referrals.map((referral) => (
                <li key={referral.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">{referral.code}</span>
                    <span className="text-muted-foreground">
                      {REFERRAL_STATUS_LABELS[referral.status] ?? referral.status}
                      {referral.reward_amount ? ` · £${Number(referral.reward_amount).toFixed(2)}` : ""}
                    </span>
                  </div>
                  {referral.status === "pending" && referral.referred_customer_id ? (
                    <CompleteReferralForm referralId={referral.id} />
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

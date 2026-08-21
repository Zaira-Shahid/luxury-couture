import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { computeSegments, type SegmentKey } from "@/lib/admin/customer-segments";
import { getAdminCustomers } from "@/lib/admin/get-customers";
import type { CampaignTarget } from "@/types/database";

export type CampaignRecipient = { profileId: string | null; email: string };

const TARGET_TO_SEGMENT: Partial<Record<CampaignTarget, SegmentKey>> = {
  vip_customers: "vip",
  new_customers: "new",
  at_risk_customers: "at_risk",
};

/**
 * Segment membership is computed here, not looked up from a stored table
 * — same "computed tags, not persisted membership" design as
 * customer-segments.ts. Customer emails come from auth.users (not
 * profiles), so a bulk listUsers() call is genuinely justified here
 * (unlike the admin customer list, which deliberately avoids it) — a
 * campaign send needs every matching recipient's email, not one row's.
 */
export async function getCampaignRecipients(target: CampaignTarget): Promise<CampaignRecipient[]> {
  if (target === "all_subscribers") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("newsletter_subscribers")
      .select("email")
      .is("unsubscribed_at", null);
    return (data ?? []).map((row) => ({ profileId: null, email: row.email }));
  }

  const segment = TARGET_TO_SEGMENT[target];
  const customers = await getAdminCustomers();
  const matching = segment ? customers.filter((c) => computeSegments(c).includes(segment)) : customers;
  if (matching.length === 0) return [];

  const admin = createAdminClient();
  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200 });
  const emailById = new Map((usersPage?.users ?? []).map((u) => [u.id, u.email ?? null]));

  const recipients: CampaignRecipient[] = [];
  for (const customer of matching) {
    const email = emailById.get(customer.id);
    if (email) recipients.push({ profileId: customer.id, email });
  }
  return recipients;
}

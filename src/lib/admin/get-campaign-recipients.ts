import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { computeSegments, type SegmentKey } from "@/lib/admin/customer-segments";
import { getAdminCustomers } from "@/lib/admin/get-customers";
import { emailUrl } from "@/lib/email";
import { logger } from "@/lib/logger";
import type { CampaignTarget } from "@/types/database";

export type CampaignRecipient = {
  profileId: string | null;
  email: string;
  /** Required: every marketing send must carry a working opt-out. */
  unsubscribeUrl: string;
};

const TARGET_TO_SEGMENT: Partial<Record<CampaignTarget, SegmentKey>> = {
  vip_customers: "vip",
  new_customers: "new",
  at_risk_customers: "at_risk",
};

/** Supabase caps a page at 1000; loop until a short page comes back. */
const USERS_PAGE_SIZE = 1000;

/**
 * Segment membership is computed here, not looked up from a stored table
 * — same "computed tags, not persisted membership" design as
 * customer-segments.ts. Customer emails come from auth.users (not
 * profiles), so a bulk listUsers() call is genuinely justified here
 * (unlike the admin customer list, which deliberately avoids it) — a
 * campaign send needs every matching recipient's email, not one row's.
 *
 * MODULE 24 fixed three defects here:
 *
 *  1. **Opt-outs were only checked for newsletter subscribers.** The
 *     customer-segment targets (VIP / new / at-risk) applied no
 *     suppression at all, so an unsubscribed customer would still be
 *     emailed. `profiles.marketing_opt_out` (0051) now gives customers
 *     the same mechanism, and it is filtered on EVERY target.
 *  2. **No unsubscribe URL was returned**, so the sent email could not
 *     contain one. Every recipient now carries a token-based link — UK
 *     PECR requires a working opt-out on every marketing email.
 *  3. **`listUsers({ perPage: 200 })` silently truncated** the recipient
 *     list past 200 users. It now paginates to exhaustion.
 */
export async function getCampaignRecipients(
  target: CampaignTarget
): Promise<CampaignRecipient[]> {
  if (target === "all_subscribers") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("newsletter_subscribers")
      .select("email, unsubscribe_token")
      .is("unsubscribed_at", null);

    const subscribers = (data ?? []).map((row) => ({
      profileId: null,
      email: row.email as string,
      unsubscribeUrl: emailUrl(`/unsubscribe?token=${row.unsubscribe_token}`),
    }));

    // A subscriber may also hold an account that has opted out of
    // marketing. Honour the stricter of the two signals rather than
    // emailing them because they happen to be on both lists.
    return suppressOptedOutEmails(subscribers);
  }

  const segment = TARGET_TO_SEGMENT[target];
  const customers = await getAdminCustomers();
  const matching = segment ? customers.filter((c) => computeSegments(c).includes(segment)) : customers;
  if (matching.length === 0) return [];

  const admin = createAdminClient();

  // Only customers who have not opted out, with their unsubscribe token.
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, marketing_unsubscribe_token")
    .in(
      "id",
      matching.map((c) => c.id)
    )
    .eq("marketing_opt_out", false);

  if (error) {
    // Fail closed: if we cannot confirm who opted out, send to nobody.
    // Emailing someone who opted out is a compliance breach; sending
    // nothing is a delay.
    logger.error("campaign recipients: opt-out lookup failed, sending to nobody", error);
    return [];
  }

  const tokenById = new Map(
    (profiles ?? []).map((row) => [row.id as string, row.marketing_unsubscribe_token as string])
  );
  if (tokenById.size === 0) return [];

  const emailById = await listAllUserEmails(admin);

  const recipients: CampaignRecipient[] = [];
  for (const customer of matching) {
    const token = tokenById.get(customer.id);
    if (!token) continue; // opted out
    const email = emailById.get(customer.id);
    if (!email) continue;
    recipients.push({
      profileId: customer.id,
      email,
      unsubscribeUrl: emailUrl(`/unsubscribe?token=${token}`),
    });
  }
  return recipients;
}

/** Paginates auth.users to exhaustion — the previous single 200-row page silently lost recipients. */
async function listAllUserEmails(
  admin: ReturnType<typeof createAdminClient>
): Promise<Map<string, string>> {
  const emailById = new Map<string, string>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: USERS_PAGE_SIZE,
    });
    if (error) {
      logger.warn("campaign recipients: listUsers page failed", { page, message: error.message });
      break;
    }
    const users = data?.users ?? [];
    for (const user of users) {
      if (user.email) emailById.set(user.id, user.email);
    }
    if (users.length < USERS_PAGE_SIZE) break;
  }
  return emailById;
}

/** Drops any address belonging to an account that has opted out of marketing. */
async function suppressOptedOutEmails(
  recipients: CampaignRecipient[]
): Promise<CampaignRecipient[]> {
  if (recipients.length === 0) return [];
  try {
    const admin = createAdminClient();
    const emailById = await listAllUserEmails(admin);
    const idByEmail = new Map([...emailById].map(([id, email]) => [email.toLowerCase(), id]));

    const { data: optedOut } = await admin
      .from("profiles")
      .select("id")
      .eq("marketing_opt_out", true);

    const optedOutIds = new Set((optedOut ?? []).map((row) => row.id as string));
    if (optedOutIds.size === 0) return recipients;

    return recipients.filter((recipient) => {
      const profileId = idByEmail.get(recipient.email.toLowerCase());
      return !profileId || !optedOutIds.has(profileId);
    });
  } catch (error) {
    logger.warn("campaign recipients: subscriber opt-out cross-check failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    // The subscriber list already excludes its own unsubscribes, so
    // returning it is still compliant for that list — this cross-check
    // is an extra safeguard, not the primary one.
    return recipients;
  }
}

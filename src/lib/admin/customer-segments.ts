import type { AdminCustomer } from "./get-customers";

export type SegmentKey = "vip" | "new" | "at_risk";

export const SEGMENT_LABELS: Record<SegmentKey, string> = {
  vip: "VIP",
  new: "New",
  at_risk: "At risk",
};

const VIP_LIFETIME_SPEND_THRESHOLD = 1000;
const NEW_CUSTOMER_DAYS = 30;
const AT_RISK_DAYS_SINCE_LAST_ORDER = 90;

function daysSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

/**
 * Computed tags, not persisted membership — the approved scope call for
 * "customer segments": derived from data that already exists
 * (getAdminCustomers()'s own aggregate) rather than a new segment-
 * definition/rule-builder system. Recomputed on every read, so a
 * customer's tags are always current.
 */
export function computeSegments(customer: AdminCustomer): SegmentKey[] {
  const tags: SegmentKey[] = [];

  if (customer.lifetimeSpend >= VIP_LIFETIME_SPEND_THRESHOLD) tags.push("vip");
  if (daysSince(customer.created_at) <= NEW_CUSTOMER_DAYS) tags.push("new");
  if (customer.orderCount > 0 && customer.lastOrderAt && daysSince(customer.lastOrderAt) >= AT_RISK_DAYS_SINCE_LAST_ORDER) {
    tags.push("at_risk");
  }

  return tags;
}

export function isInSegment(customer: AdminCustomer, segment: SegmentKey): boolean {
  return computeSegments(customer).includes(segment);
}

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import type { WriteResult } from "@/lib/orders/write-orders";

import type { EnquiryStatus } from "@/types/database";

/**
 * Enquiry WRITE services and transition rules — Module 39.
 *
 * ONE FILE, unlike orders and production, which each got a separate
 * `transitions.ts`. The rules here are four states and two sentences;
 * splitting them into their own file would produce a file whose header
 * comment is longer than its logic, and the reason the order rules live
 * apart is that the admin UI reads them too. Nothing else reads these.
 *
 * Extracted from `src/features/admin-enquiries/actions.ts` for the
 * cookie-client reason recorded in `write-orders.ts`.
 */

/**
 * The pipeline, in order. An enquiry arrives `new`, someone picks it up
 * (`in_review`), a quotation goes out (`quoted`), and it ends `closed`.
 */
export const ENQUIRY_STATUS_SEQUENCE = ["new", "in_review", "quoted", "closed"] as const;

/**
 * `closed` is the end. Reopening a closed enquiry is a judgement about
 * whether a customer's follow-up is the same conversation or a new one,
 * and that is not a judgement a tool should make — a new enquiry costs
 * nothing and keeps the history honest.
 */
export const TERMINAL_ENQUIRY_STATUS = "closed" satisfies EnquiryStatus;

function position(status: EnquiryStatus): number {
  return (ENQUIRY_STATUS_SEQUENCE as readonly string[]).indexOf(status);
}

export function allowedEnquiryTransitions(from: EnquiryStatus): EnquiryStatus[] {
  if (from === TERMINAL_ENQUIRY_STATUS) return [];
  return ENQUIRY_STATUS_SEQUENCE.filter((s) => position(s) > position(from));
}

/**
 * `allowCorrection` carries the meaning documented in
 * `src/lib/orders/transitions.ts`: the admin UI passes `true` and keeps
 * the freedom it has always had, MCP passes `false`.
 */
export function checkEnquiryTransition(
  from: EnquiryStatus,
  to: EnquiryStatus,
  options: { allowCorrection?: boolean } = {}
): { ok: true } | { ok: false; reason: string } {
  if (from === to) return { ok: false, reason: `This enquiry is already ${to.replace(/_/g, " ")}.` };
  if (options.allowCorrection) return { ok: true };

  if (from === TERMINAL_ENQUIRY_STATUS) {
    return {
      ok: false,
      reason:
        "This enquiry is closed. Reopening one is a person's judgement — if the customer has come " +
        "back, that is a new enquiry.",
    };
  }

  if (position(to) < position(from)) {
    return {
      ok: false,
      reason:
        `An enquiry cannot move from ${from.replace(/_/g, " ")} back to ${to.replace(/_/g, " ")}. ` +
        `Allowed next: ${allowedEnquiryTransitions(from).join(", ") || "none"}.`,
    };
  }

  return { ok: true };
}

export async function updateEnquiryStatusRecord(
  params: { enquiryId: string; status: EnquiryStatus; allowCorrection?: boolean },
  client: SupabaseClient
): Promise<WriteResult<{ enquiryId: string; previousStatus: EnquiryStatus; status: EnquiryStatus }>> {
  const { data: enquiry } = await client
    .from("enquiries")
    .select("status")
    .eq("id", params.enquiryId)
    .maybeSingle();

  if (!enquiry) return { ok: false, error: "Enquiry not found." };

  const previousStatus = enquiry.status as EnquiryStatus;

  const check = checkEnquiryTransition(previousStatus, params.status, {
    allowCorrection: params.allowCorrection,
  });
  if (!check.ok) return { ok: false, error: check.reason };

  const { error } = await client
    .from("enquiries")
    .update({ status: params.status })
    .eq("id", params.enquiryId);

  if (error) {
    logger.error("enquiry status update failed", error, { id: params.enquiryId });
    return { ok: false, error: "Could not update. Please try again." };
  }

  return { ok: true, data: { enquiryId: params.enquiryId, previousStatus, status: params.status } };
}

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  checkEnquiryTransition,
  updateEnquiryStatusRecord,
} from "@/lib/enquiries/write-enquiries";
import { logger } from "@/lib/logger";
import type { WriteResult } from "@/lib/orders/write-orders";

import type { EnquiryStatus } from "@/types/database";

import type { McpContext } from "../context";
import { McpError } from "../errors";
import type { AnyToolDefinition } from "../registry";
import { uuid } from "./shared";

/**
 * Enquiry WRITE tools — Module 39. One tool.
 *
 * MEDIUM RISK, and the contrast with `orders-write.ts` is the reason to
 * say so out loud. An enquiry status is a note to the sales team about
 * how far a conversation has got. Nothing is sent to the customer when it
 * changes — no email, no timeline entry — so a wrong value misleads
 * colleagues for as long as it takes someone to notice, which is not the
 * same kind of harm as telling a customer their order shipped.
 *
 * ASSIGNMENT IS NOT HERE. `assignEnquiryToSelf` assigns to the CALLER,
 * and "self" is not a thing an assistant meaningfully is — it would mean
 * the assistant assigning work to whichever human's token it happens to
 * be holding. A tool for that would need to name a person, which is a
 * different feature and not one this module was asked for.
 */

/** See the identical helper in catalog-write.ts — never fatal. */
function revalidate(paths: string[]): void {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch (error) {
      logger.warn("mcp revalidate failed", { path, message: String(error) });
    }
  }
}

function unwrap<T>(result: WriteResult<T>): T {
  if (!result.ok) throw new McpError("BUSINESS_RULE_ERROR", result.error);
  return result.data;
}

async function requireEnquiry(id: string, ctx: McpContext): Promise<{ status: EnquiryStatus }> {
  const { data } = await ctx.supabase
    .from("enquiries")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (!data) throw new McpError("NOT_FOUND", "No enquiry with that id.");
  return data as { status: EnquiryStatus };
}

const enquiriesUpdateStatus: AnyToolDefinition = {
  name: "enquiries_update_status",
  title: "Move an enquiry to a new status",
  description:
    "Move an enquiry forward: new, in review, quoted, closed. It cannot move backward, and a closed " +
    "enquiry cannot be reopened — if the customer comes back, that is a new enquiry. The customer " +
    "is not notified; this status is an internal record of where the conversation has got to. " +
    "It cannot assign the enquiry to anyone or send a quotation.",
  kind: "write",
  risk: "medium",
  permission: "enquiries.write",
  inputSchema: z
    .object({
      id: uuid("The enquiry's id."),
      status: z
        .enum(["new", "in_review", "quoted", "closed"])
        .describe("The status to move to. Must be later in the pipeline than the current status."),
    })
    .strict(),
  handler: async (input, ctx) => {
    const enquiry = await requireEnquiry(input.id, ctx);

    const check = checkEnquiryTransition(enquiry.status, input.status as EnquiryStatus);
    if (!check.ok) throw new McpError("BUSINESS_RULE_ERROR", check.reason);

    const result = unwrap(
      await updateEnquiryStatusRecord(
        { enquiryId: input.id, status: input.status as EnquiryStatus, allowCorrection: false },
        ctx.supabase
      )
    );

    revalidate(["/admin/enquiries", `/admin/enquiries/${input.id}`]);

    return {
      action: `Enquiry moved to ${input.status.replace(/_/g, " ")}`,
      target: { type: "enquiry", id: input.id },
      data: result,
    };
  },
};

export const enquiriesWriteTools: AnyToolDefinition[] = [enquiriesUpdateStatus];

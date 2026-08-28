import { z } from "zod";

import { getAdminEnquiries, getAdminEnquiry } from "@/lib/enquiries/get-enquiries";

import { McpError } from "../errors";
import { paginate, paginationShape } from "../paginate";
import type { AnyToolDefinition } from "../registry";
import { readerOptions, uuid } from "./shared";

/**
 * Enquiry read tools — Module 37.
 *
 * `enquiries.read`, the key `/admin/enquiries` requires.
 *
 * Enquiries carry a member of the public's name, email and phone number,
 * which is the most personal data any tool in this module returns. The
 * list deliberately withholds the contact details and the message body:
 * an assistant asked "how many new enquiries are there?" has no business
 * receiving twenty people's phone numbers to answer it. `enquiries_get`
 * returns them for ONE enquiry, which is the point at which a member of
 * staff has actually asked about that person.
 */

const ENQUIRY_STATUSES = ["new", "in_review", "quoted", "closed"] as const;

const enquiriesList: AnyToolDefinition = {
  name: "enquiries_list",
  title: "List enquiries",
  description:
    "List customer enquiries, newest first, optionally filtered by status. Returns the enquirer's " +
    "name, the type and the status — NOT their email, phone number or message. Use enquiries_get " +
    "for one enquiry's contact details. Reads only; it cannot reply or change a status.",
  kind: "read",
  risk: "low",
  permission: "enquiries.read",
  inputSchema: z
    .object({
      status: z
        .enum(ENQUIRY_STATUSES)
        .optional()
        .describe("Only return enquiries in this state. Omit for all states."),
      ...paginationShape,
    })
    .strict(),
  handler: async (input, ctx) => {
    const rows = await getAdminEnquiries(input.status, readerOptions(ctx));
    const page = paginate(
      rows.map((enquiry) => ({
        id: enquiry.id,
        type: enquiry.type,
        status: enquiry.status,
        contactName: enquiry.contact_name,
        hasMessage: Boolean(enquiry.message),
        createdAt: enquiry.created_at,
      })),
      input
    );

    return {
      action: input.status ? `Listed ${input.status} enquiries` : "Listed enquiries",
      data: page,
    };
  },
};

const enquiriesGet: AnyToolDefinition = {
  name: "enquiries_get",
  title: "Get an enquiry",
  description:
    "Get one enquiry by its id, including the enquirer's contact details and their message. Reads " +
    "only; it cannot reply, assign, or change the status.",
  kind: "read",
  risk: "low",
  permission: "enquiries.read",
  inputSchema: z.object({ id: uuid("The enquiry's id.") }).strict(),
  handler: async (input, ctx) => {
    const enquiry = await getAdminEnquiry(input.id, readerOptions(ctx));
    if (!enquiry) throw new McpError("NOT_FOUND", "That enquiry could not be found.");

    return {
      action: "Retrieved enquiry",
      target: { type: "enquiry", id: enquiry.id },
      data: {
        id: enquiry.id,
        type: enquiry.type,
        status: enquiry.status,
        contactName: enquiry.contact_name,
        contactEmail: enquiry.contact_email,
        contactPhone: enquiry.contact_phone,
        message: enquiry.message,
        customerId: enquiry.customer_id,
        builderConfigurationId: enquiry.builder_configuration_id,
        createdAt: enquiry.created_at,
      },
    };
  },
};

export const enquiryTools: AnyToolDefinition[] = [enquiriesList, enquiriesGet];

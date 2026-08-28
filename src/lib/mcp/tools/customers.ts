import { z } from "zod";

import { getAdminCustomerDetail, getAdminCustomers } from "@/lib/admin/get-customers";
import { computeSegments } from "@/lib/admin/customer-segments";

import { McpError } from "../errors";
import { paginate, paginationShape } from "../paginate";
import type { AnyToolDefinition } from "../registry";
import { readerOptions, uuid } from "./shared";

/**
 * Customer read tools — Module 37.
 *
 * `customers.read`, the key `/admin/customers` requires.
 *
 * THE ONE PRIVILEGED READ ON THE MCP PATH, recorded in Master Build Plan
 * 12B.11: `customers_get` reaches `getAdminCustomerDetail`, which fetches
 * the customer's email through the service-role client because email
 * lives in `auth.users` and no RLS-respecting query can reach it. The
 * elevation is bounded to that single field, on a profile row the caller
 * was already granted under their own RLS, behind the same permission the
 * admin customer page requires. Approved by the developer before this
 * module was built. It is the only one; no other tool in this module
 * touches the service-role client.
 *
 * `customers_search` returns no contact details at all — searching for a
 * customer and reading a customer's file are different acts, and only the
 * second one should hand over an email address.
 */

const customersSearch: AnyToolDefinition = {
  name: "customers_search",
  title: "Search customers",
  description:
    "Find customers by name, with their order count, lifetime spend and computed segment tags " +
    "(VIP / New / At risk). Returns NO contact details — use customers_get for one customer's " +
    "full record. Reads only; it cannot edit a customer.",
  kind: "read",
  risk: "low",
  permission: "customers.read",
  inputSchema: z
    .object({
      query: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .optional()
        .describe("Match against the customer's name. Omit to list all customers."),
      ...paginationShape,
    })
    .strict(),
  handler: async (input, ctx) => {
    const all = await getAdminCustomers(readerOptions(ctx));

    const needle = input.query?.toLowerCase();
    const matched = needle
      ? all.filter((c) => (c.full_name ?? "").toLowerCase().includes(needle))
      : all;

    const page = paginate(
      matched.map((customer) => ({
        id: customer.id,
        fullName: customer.full_name,
        orderCount: customer.orderCount,
        lifetimeSpend: customer.lifetimeSpend,
        lastOrderAt: customer.lastOrderAt,
        segments: computeSegments(customer),
        joinedAt: customer.created_at,
      })),
      input
    );

    return {
      action: input.query ? `Searched customers for "${input.query}"` : "Listed customers",
      data: page,
    };
  },
};

const customersGet: AnyToolDefinition = {
  name: "customers_get",
  title: "Get a customer",
  description:
    "Get one customer by their id: their profile, email address, order history, quotations, " +
    "saved addresses, loyalty balance and referrals. Reads only; it cannot edit a customer, " +
    "change their loyalty balance, or contact them.",
  kind: "read",
  risk: "low",
  permission: "customers.read",
  inputSchema: z.object({ id: uuid("The customer's profile id.") }).strict(),
  handler: async (input, ctx) => {
    const detail = await getAdminCustomerDetail(input.id, readerOptions(ctx));
    if (!detail) throw new McpError("NOT_FOUND", "That customer could not be found.");

    return {
      action: "Retrieved customer",
      target: { type: "customer", id: detail.profile.id },
      data: {
        id: detail.profile.id,
        fullName: detail.profile.full_name,
        email: detail.email,
        phone: detail.profile.phone,
        joinedAt: detail.profile.created_at,
        orders: detail.orders.map((order) => ({
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
          total: Number(order.total_amount),
          currency: order.currency,
          createdAt: order.created_at,
        })),
        quotations: detail.quotations.map((quotation) => ({
          id: quotation.id,
          status: quotation.status,
          quotedPrice: Number(quotation.quoted_price),
          createdAt: quotation.created_at,
        })),
        addressCount: detail.addresses.length,
        loyaltyPoints: detail.loyaltyAccount?.points_balance ?? 0,
        referralCount: detail.referrals.length,
      },
    };
  },
};

export const customerTools: AnyToolDefinition[] = [customersSearch, customersGet];

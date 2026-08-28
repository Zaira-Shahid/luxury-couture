import { z } from "zod";

/**
 * Result-size control for `_list` tools (Module 37).
 *
 * WHY EVERY LIST TOOL NEEDS THIS: the existing readers return everything.
 * `getAdminCustomers()` loads every profile AND every order to compute
 * lifetime spend; `getAdminOrders()` returns the whole table. A page
 * renders that into a scrollable list and nobody notices. A tool feeds it
 * into a model's context window, where an unbounded result is both a cost
 * and a data-minimisation problem — the assistant is handed far more
 * customer data than the question needed.
 *
 * The cap is applied HERE, after the reader, rather than pushed into the
 * reader as a `.range()`: the readers are shared with pages that depend
 * on getting the full set, and several of them (customers, most of all)
 * compute aggregates across every row before returning. Slicing at the
 * tool boundary keeps the reader's contract and the page's behaviour
 * untouched, which is the whole point of reusing them.
 */

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** The `limit`/`offset` pair every `_list` tool accepts. */
export const paginationShape = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .default(DEFAULT_LIMIT)
    .describe(`How many records to return. Between 1 and ${MAX_LIMIT}.`),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("How many records to skip, for paging through a long list."),
};

export type Pagination = { limit: number; offset: number };

export type Page<T> = {
  items: T[];
  /** How many records exist in total, so an assistant can say "showing 20 of 340". */
  total: number;
  offset: number;
  limit: number;
  /** Stated explicitly rather than left to be derived from the three numbers above. */
  hasMore: boolean;
};

/**
 * Slices a full reader result into one page.
 *
 * `total` is the real total, not the page length — an assistant told
 * "3 orders" when there are 340 would report it as fact, and "no more
 * results" is a claim a tool must not make wrongly.
 */
export function paginate<T>(rows: T[], { limit, offset }: Pagination): Page<T> {
  const items = rows.slice(offset, offset + limit);
  return {
    items,
    total: rows.length,
    offset,
    limit,
    hasMore: offset + items.length < rows.length,
  };
}

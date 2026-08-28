import { buildRegistry } from "../registry";

import { systemTools } from "./system";

/**
 * THE registry. Everything the AI can do inside this application is on
 * this list, and nothing else is reachable.
 *
 * ONE FILE PER DOMAIN, assembled here — never one file containing every
 * tool. A later module adds its own `./products`, `./orders`,
 * `./production` and so on, and touches this file only to append its
 * export, so the security review for a module is a review of one file.
 *
 * Built at import time, which means `buildRegistry()`'s invariants (naming
 * convention, unique names, writes declare a permission, high risk implies
 * a write with describeImpact) are checked when the module loads: a
 * violation fails the build and every test run rather than waiting to
 * surface on a production call.
 *
 * Roadmap (Master Build Plan 12C):
 *   Module 37 — read tools:   products, collections, orders, enquiries,
 *                             customers, production, builder options
 *   Module 38 — write tools:  products, collections, builder options
 *   Module 39 — orders and production status
 *   Module 40 — content and SEO
 *   Module 41 — analytics summaries
 */
export const toolRegistry = buildRegistry([...systemTools]);

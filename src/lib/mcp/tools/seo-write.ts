import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logger } from "@/lib/logger";
import type { WriteResult } from "@/lib/orders/write-orders";
import {
  saveSeoOverrideRecord,
  setIndexingEnabled,
  updateSeoDefaultsRecord,
} from "@/lib/seo/write-seo";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

import { McpError } from "../errors";
import type { AnyToolDefinition } from "../registry";
import { uuid } from "./shared";

/**
 * SEO tools — Module 40, and the permissions here are NOT the one
 * `/admin/seo` takes.
 *
 * The route is gated on `content.write`, but migration 0054 gates
 * `site_settings` on `settings.manage` and `seo_metadata` on
 * `content.write`. So the reader and the per-page override take
 * `content.write`, and the two tools that write `site_settings` take
 * `settings.manage` — what the database actually requires. Declaring the
 * route's key would have offered these tools to a marketing account and
 * had RLS refuse every call.
 *
 * That mismatch is not something this module introduced: a marketing
 * user can open /admin/seo today and every save fails. It is recorded in
 * 12B.14 rather than fixed here, because changing a route gate is a
 * permissions decision, not an MCP one.
 *
 * INDEXING IS ITS OWN TOOL, and this is the module's main risk judgement.
 * `seo_update_settings` edits titles and descriptions; getting one wrong
 * costs a worse search snippet until somebody fixes it. Turning indexing
 * OFF removes the entire site from search results, and search engines do
 * not restore rankings the moment it is switched back on. `risk` is
 * declared per tool, so an editor that also carried `indexingEnabled`
 * would be an unconfirmed delisting tool wearing the name of a title
 * change — the same reasoning that split `products_publish` out of
 * `products_update` in Module 38.
 *
 * NO TOOL WRITES AN ARBITRARY SETTING. `site_settings` is one key-value
 * table holding currency, theme, notification switches and the SEO
 * defaults side by side. The service fixes the `seo.*` keys and the
 * caller supplies only values, so no argument can reach another
 * namespace — 12B.15's "no tool takes a table name", applied to keys.
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

const seoGetSettings: AnyToolDefinition = {
  name: "seo_get_settings",
  title: "Read the site-wide SEO settings",
  description:
    "Read the site-wide SEO defaults: default title and description, the Open Graph image, the " +
    "Twitter handle, the Google verification token, and whether search engines are allowed to " +
    "index the site. Reads only; it changes nothing.",
  kind: "read",
  risk: "low",
  permission: "content.write",
  inputSchema: z.object({}).strict(),
  handler: async () => {
    const settings = await getSiteSettings();
    return {
      action: "Read the SEO settings",
      data: settings.seo,
    };
  },
};

const seoUpdateSettings: AnyToolDefinition = {
  name: "seo_update_settings",
  title: "Edit the site-wide SEO defaults",
  description:
    "Edit the site-wide SEO defaults — default title, default description, Open Graph image, " +
    "Twitter handle, Google verification token. Omitting a field leaves it unchanged; pass null " +
    "to clear one. It cannot turn search indexing on or off: that is seo_set_indexing.",
  kind: "write",
  risk: "medium",
  // settings.manage, not content.write — see the file header.
  permission: "settings.manage",
  inputSchema: z
    .object({
      defaultTitle: z.string().trim().max(200).nullable().optional(),
      defaultDescription: z.string().trim().max(500).nullable().optional(),
      defaultOgImageUrl: z.string().trim().max(2000).nullable().optional(),
      twitterHandle: z.string().trim().max(50).nullable().optional(),
      googleSiteVerification: z
        .string()
        .trim()
        .max(200)
        .nullable()
        .optional()
        .describe("Clearing this un-verifies the site in Google Search Console."),
    })
    .strict(),
  handler: async (input, ctx) => {
    // The admin form adds a leading "@" rather than rejecting a handle
    // typed without one; the same courtesy applies here, at the one
    // boundary where the tool schema and the domain schema meet.
    const twitterHandle =
      input.twitterHandle && !input.twitterHandle.startsWith("@")
        ? `@${input.twitterHandle}`
        : input.twitterHandle;

    const result = unwrap(
      await updateSeoDefaultsRecord({ ...input, twitterHandle }, ctx.supabase)
    );

    // Site-wide metadata touches every route.
    revalidate(["/admin/seo"]);
    try {
      revalidatePath("/", "layout");
    } catch (error) {
      logger.warn("mcp layout revalidate failed", { message: String(error) });
    }

    return { action: "SEO defaults updated", data: result };
  },
};

const seoSetIndexing: AnyToolDefinition = {
  name: "seo_set_indexing",
  title: "Allow or block search engine indexing",
  description:
    "Allow or block search engines from indexing the entire site. Blocking removes the site from " +
    "search results, and rankings do not return the moment it is allowed again. Requires " +
    "confirmation: the first call describes what would change and changes nothing.",
  kind: "write",
  risk: "high",
  permission: "settings.manage",
  inputSchema: z
    .object({
      enabled: z.boolean().describe("True to allow indexing, false to block the whole site."),
    })
    .strict(),
  describeImpact: async (input) => {
    const settings = await getSiteSettings();
    const current = settings.seo.indexingEnabled;

    if (current === input.enabled) {
      return {
        summary: `Indexing is already ${current ? "allowed" : "blocked"}. This would change nothing.`,
        affectedRecords: 0,
      };
    }

    return {
      summary: input.enabled
        ? "Allow search engines to index the whole site again. Rankings recover over weeks, not immediately."
        : "BLOCK search engines from the whole site. Every page drops out of search results.",
      affectedRecords: 1,
    };
  },
  handler: async (input, ctx) => {
    const result = unwrap(await setIndexingEnabled(input.enabled, ctx.supabase));

    revalidate(["/admin/seo"]);
    try {
      revalidatePath("/", "layout");
    } catch (error) {
      logger.warn("mcp layout revalidate failed", { message: String(error) });
    }

    return { action: input.enabled ? "Indexing allowed" : "Indexing blocked", data: result };
  },
};

const seoUpdateOverride: AnyToolDefinition = {
  name: "seo_update_override",
  title: "Set one page's SEO override",
  description:
    "Set the SEO override for a single product, collection, page or blog post — its meta title, " +
    "meta description, Open Graph image and canonical URL. Omitting a field leaves it unchanged; " +
    "pass null to clear one and fall back to the site defaults. It cannot edit the item itself, " +
    "only how search engines and link previews describe it.",
  kind: "write",
  risk: "medium",
  permission: "content.write",
  inputSchema: z
    .object({
      // A domain enum stored in seo_metadata.entity_type, not a table
      // name — it reaches no query builder as an identifier (12B.15).
      entityType: z
        .enum(["product", "collection", "page", "blog_post"])
        .describe("What kind of item this override describes."),
      entityId: uuid("The item's id."),
      metaTitle: z.string().trim().max(200).nullable().optional(),
      metaDescription: z.string().trim().max(500).nullable().optional(),
      ogImageUrl: z.string().trim().max(2000).nullable().optional(),
      canonicalUrl: z.string().trim().max(2000).nullable().optional(),
    })
    .strict(),
  handler: async (input, ctx) => {
    const result = unwrap(await saveSeoOverrideRecord(input, ctx.supabase));

    revalidate(["/admin/seo"]);
    try {
      revalidatePath("/", "layout");
    } catch (error) {
      logger.warn("mcp layout revalidate failed", { message: String(error) });
    }

    return {
      action: result.created ? "SEO override created" : "SEO override updated",
      target: { type: input.entityType, id: input.entityId },
      data: result,
    };
  },
};

export const seoTools: AnyToolDefinition[] = [
  seoGetSettings,
  seoUpdateSettings,
  seoSetIndexing,
  seoUpdateOverride,
];

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAdminBanner, getAdminBanners } from "@/lib/admin/get-banners";
import {
  createBannerRecord,
  draftBlogPostRecord,
  setBannerActive,
  updateBannerRecord,
} from "@/lib/content/write-content";
import { logger } from "@/lib/logger";
import type { WriteResult } from "@/lib/orders/write-orders";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

import { McpError } from "../errors";
import type { AnyToolDefinition } from "../registry";
import { readerOptions, uuid } from "./shared";

/**
 * Content tools — Module 40.
 *
 * EACH TOOL TAKES THE PERMISSION ITS TABLE REQUIRES, which is not always
 * the one its admin page requires. Module 37's rule was "a tool takes the
 * permission its admin page takes", and for the catalogue, orders and
 * production the route gate and the RLS policy agree. Here they do not:
 * `/admin/marketing` and `/admin/content` are both reachable with
 * `content.write`, but migration 0054 gates `promotional_banners` on
 * `marketing.write`. A banner tool declaring `content.write` would be
 * OFFERED to a role the database then refuses — a tool that appears in
 * tools/list and fails on use, which is worse than not being listed.
 *
 * So blog drafting takes `content.write` (0054 gates `blog_posts` on it)
 * and every banner tool takes `marketing.write`. There is no
 * `content.read` key in the twenty-three-key catalogue, so each reader
 * takes the same key as its writers.
 *
 * THE ANNOUNCEMENT TOOL THIS MODULE WAS SPECIFIED WITH DOES NOT EXIST AS
 * SPECIFIED. `content_update_announcement` targets Module 3's single
 * global `store.announcement_*` banner, which Module 19 Pass 2 replaced
 * with `promotional_banners` — several, scheduled, each independently
 * active. The old settings keys are still readable and are deliberately
 * ignored by `getSiteSettings()`, so a tool written against them would
 * have appeared to work and changed nothing on the storefront. The
 * banner tools below are the honest equivalent.
 *
 * AI DRAFTS CANNOT BE PUBLISHED BY ANY TOOL HERE. 12B.12 forbids
 * automatic publication of AI-written copy, so `content_draft_blog_post`
 * takes no `status` and no `ai_generated` argument: it always writes a
 * marked draft. Publishing stays a human action in /admin/content.
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

/** ISO date-time or date, as the banner schedule columns store. */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}([T ].*)?$/, "Use an ISO date, e.g. 2026-09-01 or 2026-09-01T09:00:00Z.");

const contentGetHomepage: AnyToolDefinition = {
  name: "content_get_homepage",
  title: "Read the homepage content",
  description:
    "Read the editable homepage copy and imagery — hero heading, subheading, hero and craft " +
    "images, and the homepage SEO title and description. Reads only; it changes nothing. " +
    "The promotional banners are a separate list: use content_list_banners.",
  kind: "read",
  risk: "low",
  permission: "content.write",
  inputSchema: z.object({}).strict(),
  handler: async () => {
    const settings = await getSiteSettings();
    return {
      action: "Read the homepage content",
      data: { homepage: settings.homepage },
    };
  },
};

/**
 * Split from `content_get_homepage` rather than folded into it, because
 * the two need different keys: the homepage copy lives in the
 * public-read `site_settings`, while listing every banner — hidden ones
 * included — is `marketing.write` under 0054. One tool returning both
 * would have to demand the stricter key to read the freely-readable half.
 */
const contentListBanners: AnyToolDefinition = {
  name: "content_list_banners",
  title: "List the promotional banners",
  description:
    "List every promotional banner, including hidden and expired ones, with its text, link, " +
    "schedule and whether it is currently showing. Reads only; it changes nothing.",
  kind: "read",
  risk: "low",
  permission: "marketing.write",
  inputSchema: z.object({}).strict(),
  handler: async (_input, ctx) => {
    const banners = await getAdminBanners(readerOptions(ctx));
    return {
      action: "Listed the promotional banners",
      data: {
        banners: banners.map((b) => ({
          id: b.id,
          text: b.text,
          linkUrl: b.link_url,
          isActive: b.is_active,
          startsAt: b.starts_at,
          expiresAt: b.expires_at,
          sortOrder: b.sort_order,
        })),
      },
    };
  },
};

const bannerShape = {
  text: z
    .string()
    .trim()
    .min(1, "A banner with no text shows an empty bar to every visitor.")
    .max(300)
    .describe("The banner text, shown across the top of the storefront."),
  linkUrl: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .describe("Where the banner links. Omit to leave unchanged, null to clear."),
  startsAt: isoDate.nullable().optional().describe("When it begins showing. Null means immediately."),
  expiresAt: isoDate.nullable().optional().describe("When it stops showing. Null means never."),
  sortOrder: z.number().int().min(0).max(999).optional().describe("Display order, lowest first."),
};

const contentCreateBanner: AnyToolDefinition = {
  name: "content_create_banner",
  title: "Create a promotional banner",
  description:
    "Create a promotional banner for the storefront. It is created HIDDEN and no visitor sees it " +
    "until content_set_banner_active shows it — creating one publishes nothing. Optionally " +
    "schedule it with a start and expiry.",
  kind: "write",
  risk: "medium",
  permission: "marketing.write",
  inputSchema: z.object(bannerShape).strict(),
  handler: async (input, ctx) => {
    const { id } = unwrap(
      await createBannerRecord(
        {
          text: input.text,
          linkUrl: input.linkUrl ?? null,
          startsAt: input.startsAt ?? null,
          expiresAt: input.expiresAt ?? null,
          sortOrder: input.sortOrder,
        },
        ctx.supabase
      )
    );

    revalidate(["/admin/marketing/banners", "/"]);
    return {
      action: "Banner created, hidden",
      target: { type: "banner", id },
      data: { id, isActive: false },
    };
  },
};

const contentUpdateBanner: AnyToolDefinition = {
  name: "content_update_banner",
  title: "Edit a promotional banner",
  description:
    "Edit a banner's text, link or schedule. Omitting a field leaves it unchanged; pass null to " +
    "clear an optional one. It cannot show or hide the banner — that is content_set_banner_active.",
  kind: "write",
  risk: "medium",
  permission: "marketing.write",
  inputSchema: z
    .object({
      id: uuid("The banner's id."),
      ...bannerShape,
      text: bannerShape.text.optional(),
    })
    .strict(),
  handler: async (input, ctx) => {
    unwrap(
      await updateBannerRecord(
        input.id,
        {
          text: input.text,
          linkUrl: input.linkUrl,
          startsAt: input.startsAt,
          expiresAt: input.expiresAt,
          sortOrder: input.sortOrder,
        },
        ctx.supabase
      )
    );

    revalidate(["/admin/marketing/banners", "/"]);
    return {
      action: "Banner updated",
      target: { type: "banner", id: input.id },
      data: { id: input.id },
    };
  },
};

const contentSetBannerActive: AnyToolDefinition = {
  name: "content_set_banner_active",
  title: "Show or hide a promotional banner",
  description:
    "Show or hide a promotional banner on the storefront. Showing one puts text in front of every " +
    "visitor, so this requires confirmation: the first call quotes the banner and changes nothing. " +
    "Hiding deletes nothing — the banner and its schedule stay.",
  kind: "write",
  // High for the same reason collections_set_visibility is: this is the
  // moment something becomes visible to the public. The editor above is
  // medium because a hidden banner's text harms nobody.
  risk: "high",
  permission: "marketing.write",
  inputSchema: z
    .object({
      id: uuid("The banner's id."),
      active: z.boolean().describe("True to show it on the storefront, false to hide it."),
    })
    .strict(),
  describeImpact: async (input, ctx) => {
    const banner = await getAdminBanner(input.id, readerOptions(ctx));
    if (!banner) throw new McpError("NOT_FOUND", "No banner with that id.");

    if (banner.is_active === input.active) {
      return {
        summary: `That banner is already ${input.active ? "showing" : "hidden"}. This would change nothing.`,
        affectedRecords: 0,
      };
    }

    // Quotes the TEXT, because "show banner 4f2a…" is not something an
    // admin can meaningfully approve.
    return {
      summary: input.active
        ? `Show "${banner.text}" to every visitor on the storefront.`
        : `Hide "${banner.text}" from the storefront.`,
      affectedRecords: 1,
    };
  },
  handler: async (input, ctx) => {
    const result = unwrap(await setBannerActive(input.id, input.active, ctx.supabase));

    revalidate(["/admin/marketing/banners", "/"]);
    return {
      action: input.active ? "Banner shown" : "Banner hidden",
      target: { type: "banner", id: input.id },
      data: result,
    };
  },
};

const contentDraftBlogPost: AnyToolDefinition = {
  name: "content_draft_blog_post",
  title: "Save an AI-drafted blog post",
  description:
    "Save a blog post you have written as a DRAFT, marked as AI-generated. It is never published " +
    "and no visitor can see it: publishing is a person's decision in the admin dashboard, after " +
    "they have read it. There is no argument that changes either of those — this tool cannot " +
    "publish anything and cannot claim a person wrote it.",
  kind: "write",
  // Medium: nothing it writes is visible to anybody outside the admin
  // dashboard until a human publishes it. The high-risk moment is that
  // publish, and it is not reachable from MCP at all.
  risk: "medium",
  permission: "content.write",
  inputSchema: z
    .object({
      title: z.string().trim().min(1, "A post needs a title.").max(200),
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lower-case hyphenated slug, e.g. bridal-lehenga-guide.")
        .max(200),
      excerpt: z.string().trim().max(500).optional().describe("Short summary for the blog index."),
      content: z.string().trim().max(50000).optional().describe("The post body."),
      coverImageUrl: z.string().trim().max(2000).optional(),
    })
    .strict(),
  handler: async (input, ctx) => {
    const result = unwrap(
      await draftBlogPostRecord(
        {
          title: input.title,
          slug: input.slug,
          excerpt: input.excerpt ?? null,
          content: input.content ?? null,
          coverImageUrl: input.coverImageUrl ?? null,
        },
        ctx.supabase
      )
    );

    revalidate(["/admin/content"]);
    return {
      action: "Blog post saved as an AI-generated draft",
      target: { type: "blog_post", id: result.id },
      data: result,
    };
  },
};

export const contentTools: AnyToolDefinition[] = [
  contentGetHomepage,
  contentListBanners,
  contentCreateBanner,
  contentUpdateBanner,
  contentSetBannerActive,
  contentDraftBlogPost,
];

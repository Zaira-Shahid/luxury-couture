import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAdminOptionRow } from "@/lib/admin/get-builder-options";
import { getAdminCollection, getAdminProduct } from "@/lib/catalog/get-admin-catalog";
import {
  createBuilderOptionRecord,
  setBuilderOptionActive,
  updateBuilderOptionRecord,
} from "@/lib/builder/write-options";
import {
  createCollectionRecord,
  createProductRecord,
  setProductStatus,
  updateCollectionRecord,
  updateProductRecord,
  type WriteResult,
} from "@/lib/catalog/write-catalog";
import { logger } from "@/lib/logger";
import { builderOptionSchema } from "@/lib/validations/builder-options";
import {
  collectionSchema,
  productImageInputSchema,
  productSchema,
} from "@/lib/validations/catalog";
import type { BuilderOptionTable, Colour, Fabric } from "@/types/database";

import { McpError } from "../errors";
import type { AnyToolDefinition } from "../registry";
import { OPTION_SETS, optionSetEnum, type OptionSetKey } from "./catalog";
import { readerOptions, uuid } from "./shared";

/**
 * Catalogue WRITE tools — Module 38. The first mutating tools in the
 * registry.
 *
 * A SEPARATE FILE FROM THE READ TOOLS, though both are the catalogue
 * domain. 12B.10's rule is "one file per domain, no single file
 * containing every tool", and its stated purpose is that reviewing a
 * module means reviewing one file. Appending eleven writers to the
 * 300-line `catalog.ts` would have served the letter of the rule and
 * defeated the purpose — the reviewer of the first mutating tools in the
 * project would have had to find them among the readers. Read and write
 * are also the axis a security review actually cuts along.
 *
 * Three rules shape every tool below.
 *
 * PARTIAL UPDATES ARE PARTIAL. Each updater reads the record first and
 * merges what it was given onto what is there. An assistant asked to fix
 * a typo sends one field; if omission meant `null`, that call would blank
 * the price, the SKU and the photographs. The merge happens BEFORE the
 * domain schema runs, so the schema still validates the whole record —
 * this is not a second, looser validation path (12B.11).
 *
 * STATUS IS NOT A FIELD HERE. Neither `products_create` nor
 * `products_update` can publish or archive anything: `status` is absent
 * from their schemas and the updater carries the existing status
 * forward. Publishing and archiving are high-risk under 12B.6 while a
 * description edit is not, and `risk` is declared per TOOL — so they are
 * separate tools, gated by confirmation, rather than one tool that would
 * either over-gate every typo fix or under-gate a publish.
 *
 * THE WIRE SCHEMA IS NOT THE DOMAIN SCHEMA. `productSchema` and friends
 * are FormData-shaped: coercions, `"" | undefined` unions, transforms to
 * `null`. `z.toJSONSchema()` refuses transforms outright, so advertising
 * them through `tools/list` would throw. The schemas here are the plain
 * JSON shape a model can actually be shown; every value still passes
 * through the domain schema before it reaches a service, so the rules
 * cannot drift.
 */

const slugField = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only.");

const nameField = z.string().trim().min(1).max(200);

/**
 * Next's data cache does not know a write happened outside a Server
 * Action, so a product published through MCP would sit invisible on the
 * storefront until the next revalidation. The Server Actions call
 * `revalidatePath` for exactly this reason and the tools are the second
 * doorway onto the same writes, so they do the same.
 *
 * Never fatal. The write has already committed by the time this runs;
 * turning a cache-hint failure into a tool error would report a
 * successful write as a failure, which is the inverse of 12B.8.
 */
function revalidate(paths: string[]): void {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch (error) {
      logger.warn("mcp revalidate failed", { path, message: String(error) });
    }
  }
}

/**
 * `null` means "no value" on the wire and in the database; the domain
 * schemas spell the same thing `undefined`, because they were written
 * for FormData where a missing field simply is not posted. Passing a
 * stored `null` straight into `productSchema` would fail validation on a
 * product that is perfectly valid — so the two spellings are reconciled
 * here, at the one boundary between them.
 */
function blank<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

/** Turns a service's `{ ok: false }` into the error model of 12B.8. */
function unwrap<T>(result: WriteResult<T>): T {
  if (!result.ok) throw new McpError("BUSINESS_RULE_ERROR", result.error);
  return result.data;
}

/**
 * Runs the domain schema over a merged record.
 *
 * A failure here is the CALLER'S fault in practice — the stored record
 * was valid when it was written — so it reports as a VALIDATION_ERROR
 * naming the field, which is what lets an assistant correct itself.
 */
function validateDomain<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new McpError(
      "VALIDATION_ERROR",
      "Some of those details weren't valid.",
      parsed.error.issues.map((issue: { path: PropertyKey[]; message: string }) => ({
        field: issue.path.join(".") || "(root)",
        message: issue.message,
      }))
    );
  }
  return parsed.data;
}

/* ---- Products ------------------------------------------------------- */

const productImages = z
  .array(productImageInputSchema)
  .max(20)
  .optional()
  .describe(
    "The product's complete image list, replacing whatever is there. Omit to leave the " +
      "existing images untouched; send an empty list only to genuinely remove them all."
  );

const productFields = {
  name: nameField.describe("The product name shown to customers."),
  sku: z.string().trim().max(100).nullish().describe("Stock keeping unit."),
  description: z.string().trim().max(5000).nullish().describe("Full product description."),
  basePrice: z.number().min(0).describe("Base price before any builder adjustments."),
  currency: z.string().trim().length(3).describe("Three-letter currency code, e.g. GBP."),
  categoryId: uuid("The category this product belongs to.").nullish(),
  isFeatured: z.boolean().describe("Whether the product is featured on the homepage."),
  metaTitle: z.string().trim().max(200).nullish().describe("SEO title override."),
  metaDescription: z.string().trim().max(400).nullish().describe("SEO description override."),
};

const productsCreate: AnyToolDefinition = {
  name: "products_create",
  title: "Create a product",
  description:
    "Create a new catalogue product. It is always created as a DRAFT and is not visible on the " +
    "storefront: this tool cannot publish anything, and publishing is a separate tool that asks " +
    "for confirmation first. It cannot edit or delete an existing product.",
  kind: "write",
  risk: "medium",
  permission: "catalog.write",
  inputSchema: z
    .object({
      ...productFields,
      slug: slugField.describe("URL slug, unique across products."),
      currency: productFields.currency.default("GBP"),
      isFeatured: productFields.isFeatured.default(false),
      images: productImages,
    })
    .strict(),
  handler: async (input, ctx) => {
    const validated = validateDomain(productSchema.omit({ images: true }), {
      ...input,
      sku: blank(input.sku),
      description: blank(input.description),
      categoryId: blank(input.categoryId),
      metaTitle: blank(input.metaTitle),
      metaDescription: blank(input.metaDescription),
      status: "draft",
    });
    const { id } = unwrap(
      await createProductRecord({ ...validated, images: input.images }, ctx.supabase)
    );

    revalidate(["/admin/products"]);
    return {
      action: "Product created as a draft",
      target: { type: "product", id },
      data: { id, name: validated.name, slug: validated.slug, status: "draft" },
    };
  },
};

/** Reads the product a write is about, or refuses. Shared by all four. */
async function requireProduct(id: string, ctx: Parameters<AnyToolDefinition["handler"]>[1]) {
  const product = await getAdminProduct(id, readerOptions(ctx));
  if (!product) throw new McpError("NOT_FOUND", "That product could not be found.");
  return product;
}

const productsUpdate: AnyToolDefinition = {
  name: "products_update",
  title: "Update a product",
  description:
    "Change the details of an existing product — name, price, description, category, images or " +
    "SEO text. Send only the fields being changed; anything omitted keeps its current value. It " +
    "CANNOT publish, unpublish or archive a product: the status is left exactly as it was.",
  kind: "write",
  risk: "medium",
  permission: "catalog.write",
  inputSchema: z
    .object({
      id: uuid("The product's id."),
      name: productFields.name.optional(),
      slug: slugField.optional().describe("URL slug, unique across products."),
      sku: productFields.sku,
      description: productFields.description,
      basePrice: productFields.basePrice.optional(),
      currency: productFields.currency.optional(),
      categoryId: productFields.categoryId,
      isFeatured: productFields.isFeatured.optional(),
      metaTitle: productFields.metaTitle,
      metaDescription: productFields.metaDescription,
      images: productImages,
    })
    .strict(),
  handler: async (input, ctx) => {
    const existing = await requireProduct(input.id, ctx);

    // Merge onto the stored row, then validate the WHOLE record. Status
    // comes from the row, never from the caller.
    const validated = validateDomain(productSchema.omit({ images: true }), {
      name: input.name ?? existing.name,
      slug: input.slug ?? existing.slug,
      sku: blank(input.sku ?? existing.sku),
      description: blank(input.description ?? existing.description),
      basePrice: input.basePrice ?? Number(existing.base_price),
      currency: input.currency ?? existing.currency,
      categoryId: blank(input.categoryId ?? existing.category_id),
      status: existing.status,
      isFeatured: input.isFeatured ?? existing.is_featured,
      metaTitle: blank(input.metaTitle),
      metaDescription: blank(input.metaDescription),
    });

    unwrap(
      await updateProductRecord(input.id, { ...validated, images: input.images }, ctx.supabase)
    );

    revalidate(["/admin/products", `/admin/products/${input.id}/edit`, "/products"]);
    return {
      action: "Product updated",
      target: { type: "product", id: input.id },
      data: { id: input.id, name: validated.name, slug: validated.slug, status: existing.status },
    };
  },
};

/**
 * Publish and archive: one shape, two tools.
 *
 * Both are high risk under 12B.6 — "publishing major content changes" and
 * "deleting or archiving products" are named there — so neither runs on
 * its first call. `describeImpact` names the product and the status it
 * would move from, because "archive a product" is not a description an
 * admin can sensibly approve; "archive Ayla Bridal Lehenga, currently
 * published" is.
 */
function statusTool(config: {
  name: string;
  title: string;
  description: string;
  status: "published" | "archived";
  verb: string;
}): AnyToolDefinition {
  return {
    name: config.name,
    title: config.title,
    description: config.description,
    kind: "write",
    risk: "high",
    permission: "catalog.write",
    inputSchema: z.object({ id: uuid("The product's id.") }).strict(),
    describeImpact: async (input, ctx) => {
      const product = await requireProduct(input.id, ctx);
      return {
        summary:
          product.status === config.status
            ? `"${product.name}" is already ${config.status}. ${config.verb} it again would change nothing.`
            : `${config.verb} "${product.name}", currently ${product.status}.`,
        affectedRecords: product.status === config.status ? 0 : 1,
      };
    },
    handler: async (input, ctx) => {
      const { previousStatus } = unwrap(
        await setProductStatus(input.id, config.status, ctx.supabase)
      );

      revalidate(["/admin/products", `/admin/products/${input.id}/edit`, "/products"]);
      return {
        action: `Product ${config.status}`,
        target: { type: "product", id: input.id },
        data: { id: input.id, previousStatus, status: config.status },
      };
    },
  };
}

const productsPublish = statusTool({
  name: "products_publish",
  title: "Publish a product",
  description:
    "Publish a product so it appears on the public storefront. Requires confirmation: the first " +
    "call describes what would be published and changes nothing.",
  status: "published",
  verb: "Publish",
});

const productsArchive = statusTool({
  name: "products_archive",
  title: "Archive a product",
  description:
    "Archive a product, removing it from the storefront while keeping the record and its order " +
    "history. Nothing is deleted. Requires confirmation: the first call describes what would be " +
    "archived and changes nothing.",
  status: "archived",
  verb: "Archive",
});

/* ---- Collections ---------------------------------------------------- */

const collectionProductIds = z
  .array(uuid("A product id."))
  .max(200)
  .optional()
  .describe(
    "The collection's complete product list, replacing whatever is there. Omit to leave the " +
      "current members untouched."
  );

const collectionsCreate: AnyToolDefinition = {
  name: "collections_create",
  title: "Create a collection",
  description:
    "Create a new catalogue collection. It is always created INACTIVE and is not visible on the " +
    "storefront; making it visible is a separate tool that asks for confirmation first.",
  kind: "write",
  risk: "medium",
  permission: "catalog.write",
  inputSchema: z
    .object({
      name: nameField.describe("The collection name."),
      slug: slugField.describe("URL slug, unique across collections."),
      description: z.string().trim().max(5000).nullish().describe("Collection description."),
      coverImageUrl: z.string().trim().max(2000).nullish().describe("Cover image URL."),
      isFeatured: z.boolean().default(false).describe("Feature this collection on the homepage."),
      metaTitle: z.string().trim().max(200).nullish().describe("SEO title override."),
      metaDescription: z.string().trim().max(400).nullish().describe("SEO description override."),
      productIds: collectionProductIds,
    })
    .strict(),
  handler: async (input, ctx) => {
    const validated = validateDomain(collectionSchema.omit({ productIds: true }), {
      ...input,
      description: blank(input.description),
      coverImageUrl: blank(input.coverImageUrl),
      metaTitle: blank(input.metaTitle),
      metaDescription: blank(input.metaDescription),
      isActive: false,
    });
    const { id } = unwrap(
      await createCollectionRecord({ ...validated, productIds: input.productIds }, ctx.supabase)
    );

    revalidate(["/admin/collections"]);
    return {
      action: "Collection created, not yet visible",
      target: { type: "collection", id },
      data: { id, name: validated.name, slug: validated.slug, isActive: false },
    };
  },
};

async function requireCollection(id: string, ctx: Parameters<AnyToolDefinition["handler"]>[1]) {
  const collection = await getAdminCollection(id, readerOptions(ctx));
  if (!collection) throw new McpError("NOT_FOUND", "That collection could not be found.");
  return collection;
}

const collectionsUpdate: AnyToolDefinition = {
  name: "collections_update",
  title: "Update a collection",
  description:
    "Change a collection's details or its list of products. Send only the fields being changed. " +
    "It CANNOT make a collection visible or hide it — visibility is left exactly as it was.",
  kind: "write",
  risk: "medium",
  permission: "catalog.write",
  inputSchema: z
    .object({
      id: uuid("The collection's id."),
      name: nameField.optional().describe("The collection name."),
      slug: slugField.optional().describe("URL slug, unique across collections."),
      description: z.string().trim().max(5000).nullish().describe("Collection description."),
      coverImageUrl: z.string().trim().max(2000).nullish().describe("Cover image URL."),
      isFeatured: z.boolean().optional().describe("Feature this collection on the homepage."),
      metaTitle: z.string().trim().max(200).nullish().describe("SEO title override."),
      metaDescription: z.string().trim().max(400).nullish().describe("SEO description override."),
      productIds: collectionProductIds,
    })
    .strict(),
  handler: async (input, ctx) => {
    const existing = await requireCollection(input.id, ctx);

    const validated = validateDomain(collectionSchema.omit({ productIds: true }), {
      name: input.name ?? existing.name,
      slug: input.slug ?? existing.slug,
      description: blank(input.description ?? existing.description),
      coverImageUrl: blank(input.coverImageUrl ?? existing.cover_image_url),
      isFeatured: input.isFeatured ?? existing.is_featured,
      isActive: existing.is_active,
      metaTitle: blank(input.metaTitle),
      metaDescription: blank(input.metaDescription),
    });

    unwrap(
      await updateCollectionRecord(
        input.id,
        { ...validated, productIds: input.productIds },
        ctx.supabase
      )
    );

    revalidate(["/admin/collections", `/admin/collections/${input.id}/edit`, "/collections"]);
    return {
      action: "Collection updated",
      target: { type: "collection", id: input.id },
      data: { id: input.id, name: validated.name, slug: validated.slug },
    };
  },
};

/**
 * A collection's visibility is `is_active`, and flipping it publishes or
 * withdraws a whole shelf of the storefront at once — 12B.6's "publishing
 * major content changes" in its most literal form. High risk both ways:
 * hiding a collection is what breaks a live campaign link.
 */
const collectionsSetVisibility: AnyToolDefinition = {
  name: "collections_set_visibility",
  title: "Show or hide a collection",
  description:
    "Make a collection visible on the storefront, or hide it. Hiding does not delete the " +
    "collection or any of its products. Requires confirmation: the first call describes what " +
    "would change and changes nothing.",
  kind: "write",
  risk: "high",
  permission: "catalog.write",
  inputSchema: z
    .object({
      id: uuid("The collection's id."),
      visible: z.boolean().describe("True to show the collection on the storefront, false to hide it."),
    })
    .strict(),
  describeImpact: async (input, ctx) => {
    const collection = await requireCollection(input.id, ctx);
    const verb = input.visible ? "Show" : "Hide";
    return {
      summary:
        collection.is_active === input.visible
          ? `"${collection.name}" is already ${input.visible ? "visible" : "hidden"}. Nothing would change.`
          : `${verb} the collection "${collection.name}" on the storefront.`,
      affectedRecords: collection.is_active === input.visible ? 0 : 1,
    };
  },
  handler: async (input, ctx) => {
    const existing = await requireCollection(input.id, ctx);

    // `updateCollectionRecord` writes the whole row, so the current
    // values are carried through unchanged and only `isActive` moves.
    unwrap(
      await updateCollectionRecord(
        input.id,
        {
          name: existing.name,
          slug: existing.slug,
          description: existing.description,
          coverImageUrl: existing.cover_image_url,
          isFeatured: existing.is_featured,
          isActive: input.visible,
          metaTitle: null,
          metaDescription: null,
        },
        ctx.supabase
      )
    );

    revalidate(["/admin/collections", "/collections", `/collections/${existing.slug}`]);
    return {
      action: input.visible ? "Collection made visible" : "Collection hidden",
      target: { type: "collection", id: input.id },
      data: { id: input.id, name: existing.name, isActive: input.visible },
    };
  },
};

/* ---- Builder options ------------------------------------------------ */

/**
 * The option set arrives as a BUSINESS name and is mapped to a table
 * here, exactly as the read tools do it. 12B.15 permanently forbids a
 * tool that takes a table name, and reusing `OPTION_SETS` from
 * `catalog.ts` rather than restating it keeps one closed enum rather than
 * two that can drift.
 */
function optionTable(key: string): BuilderOptionTable {
  return OPTION_SETS[key as OptionSetKey];
}

const optionFields = {
  name: nameField.describe("The option name shown in the builder."),
  imageUrl: z.string().trim().max(2000).nullish().describe("Swatch or preview image URL."),
  priceAdjustment: z
    .number()
    .describe("Amount added to the base price when a customer picks this option."),
  sortOrder: z.number().int().describe("Position in the builder's list."),
  description: z.string().trim().max(1000).nullish().describe("Short description. Not for colours."),
  hexValue: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish()
    .describe("Hex colour like #A1B2C3. Colours only."),
};

const builderOptionsCreate: AnyToolDefinition = {
  name: "builder_options_create",
  title: "Add a custom-builder option",
  description:
    "Add an option to one of the custom lehenga builder's sets — fabric, embroidery, colour, " +
    "sleeve, neckline or dupatta. It is created INACTIVE, so customers do not see it until it is " +
    "activated. It cannot edit or remove an existing option.",
  kind: "write",
  risk: "medium",
  permission: "catalog.write",
  inputSchema: z
    .object({
      optionSet: optionSetEnum,
      name: optionFields.name,
      slug: slugField.describe("URL slug, unique within the option set."),
      imageUrl: optionFields.imageUrl,
      priceAdjustment: optionFields.priceAdjustment.default(0),
      sortOrder: optionFields.sortOrder.default(0),
      description: optionFields.description,
      hexValue: optionFields.hexValue,
    })
    .strict(),
  handler: async (input, ctx) => {
    const table = optionTable(input.optionSet);
    const validated = validateDomain(builderOptionSchema, {
      name: input.name,
      slug: input.slug,
      imageUrl: input.imageUrl ?? "",
      priceAdjustment: input.priceAdjustment,
      isActive: false,
      sortOrder: input.sortOrder,
      description: input.description ?? "",
      hexValue: input.hexValue ?? "",
    });

    const { id } = unwrap(await createBuilderOptionRecord(table, validated, ctx.supabase));

    revalidate([`/admin/builder/${table}`]);
    return {
      action: `${input.optionSet} option created, not yet offered to customers`,
      target: { type: input.optionSet, id },
      data: { id, name: validated.name, slug: validated.slug, isActive: false },
    };
  },
};

async function requireOption(
  key: string,
  id: string,
  ctx: Parameters<AnyToolDefinition["handler"]>[1]
) {
  const row = await getAdminOptionRow<Fabric | Colour>(optionTable(key), id, readerOptions(ctx));
  if (!row) throw new McpError("NOT_FOUND", "That builder option could not be found.");
  return row;
}

const builderOptionsUpdate: AnyToolDefinition = {
  name: "builder_options_update",
  title: "Update a custom-builder option",
  description:
    "Change a builder option's name, price adjustment, image, description or position. Send only " +
    "the fields being changed. It CANNOT activate or deactivate an option — whether customers " +
    "can pick it is left exactly as it was.",
  kind: "write",
  risk: "medium",
  permission: "catalog.write",
  inputSchema: z
    .object({
      optionSet: optionSetEnum,
      id: uuid("The option's id."),
      name: optionFields.name.optional(),
      slug: slugField.optional().describe("URL slug, unique within the option set."),
      imageUrl: optionFields.imageUrl,
      priceAdjustment: optionFields.priceAdjustment.optional(),
      sortOrder: optionFields.sortOrder.optional(),
      description: optionFields.description,
      hexValue: optionFields.hexValue,
    })
    .strict(),
  handler: async (input, ctx) => {
    const existing = await requireOption(input.optionSet, input.id, ctx);
    const table = optionTable(input.optionSet);

    const validated = validateDomain(builderOptionSchema, {
      name: input.name ?? existing.name,
      slug: input.slug ?? existing.slug,
      imageUrl: input.imageUrl ?? existing.image_url ?? "",
      priceAdjustment: input.priceAdjustment ?? Number(existing.price_adjustment),
      isActive: existing.is_active,
      sortOrder: input.sortOrder ?? existing.sort_order,
      description:
        input.description ?? ("description" in existing ? (existing.description ?? "") : ""),
      hexValue: input.hexValue ?? ("hex_value" in existing ? (existing.hex_value ?? "") : ""),
    });

    unwrap(await updateBuilderOptionRecord(table, input.id, validated, ctx.supabase));

    revalidate([`/admin/builder/${table}`, "/builder"]);
    return {
      action: `${input.optionSet} option updated`,
      target: { type: input.optionSet, id: input.id },
      data: { id: input.id, name: validated.name, slug: validated.slug },
    };
  },
};

/**
 * Activation is medium, deactivation is high, and the asymmetry is the
 * point. Offering a new choice is additive and reversible; withdrawing
 * one takes away something a customer may be halfway through choosing,
 * which is 12B.6's "removing something customers can pick".
 *
 * Neither DELETES. A deleted option is referenced by every saved builder
 * configuration that chose it; `is_active` withdraws it while leaving the
 * history readable.
 */
function activationTool(config: {
  name: string;
  title: string;
  description: string;
  active: boolean;
  risk: "medium" | "high";
}): AnyToolDefinition {
  const definition: AnyToolDefinition = {
    name: config.name,
    title: config.title,
    description: config.description,
    kind: "write",
    risk: config.risk,
    permission: "catalog.write",
    inputSchema: z.object({ optionSet: optionSetEnum, id: uuid("The option's id.") }).strict(),
    handler: async (input, ctx) => {
      const table = optionTable(input.optionSet);
      const { previouslyActive, name } = unwrap(
        await setBuilderOptionActive(table, input.id, config.active, ctx.supabase)
      );

      revalidate([`/admin/builder/${table}`, "/builder"]);
      return {
        action: config.active
          ? `${input.optionSet} option offered to customers`
          : `${input.optionSet} option withdrawn`,
        target: { type: input.optionSet, id: input.id },
        data: { id: input.id, name, previouslyActive, isActive: config.active },
      };
    },
  };

  if (config.risk === "high") {
    definition.describeImpact = async (input, ctx) => {
      const option = await requireOption(input.optionSet, input.id, ctx);
      return {
        summary: option.is_active
          ? `Withdraw the ${input.optionSet} option "${option.name}" from the custom builder. Existing orders keep it.`
          : `"${option.name}" is already withdrawn. Nothing would change.`,
        affectedRecords: option.is_active ? 1 : 0,
      };
    };
  }

  return definition;
}

const builderOptionsActivate = activationTool({
  name: "builder_options_activate",
  title: "Offer a builder option to customers",
  description:
    "Make a custom-builder option selectable by customers. Additive and reversible; it does not " +
    "change the option's price or details.",
  active: true,
  risk: "medium",
});

const builderOptionsDeactivate = activationTool({
  name: "builder_options_deactivate",
  title: "Withdraw a builder option",
  description:
    "Stop offering a custom-builder option to customers. The option is not deleted and existing " +
    "orders that chose it are unaffected. Requires confirmation: the first call describes what " +
    "would be withdrawn and changes nothing.",
  active: false,
  risk: "high",
});

export const catalogWriteTools: AnyToolDefinition[] = [
  productsCreate,
  productsUpdate,
  productsPublish,
  productsArchive,
  collectionsCreate,
  collectionsUpdate,
  collectionsSetVisibility,
  builderOptionsCreate,
  builderOptionsUpdate,
  builderOptionsActivate,
  builderOptionsDeactivate,
];

import { z } from "zod";

import { getAdminOptionRow, getAdminOptionRows } from "@/lib/admin/get-builder-options";
import {
  getAdminCollection,
  getAdminCollections,
  getAdminProduct,
  getAdminProducts,
} from "@/lib/catalog/get-admin-catalog";
import type { BuilderOptionTable, Colour, Fabric } from "@/types/database";

import { McpError } from "../errors";
import { paginate, paginationShape } from "../paginate";
import type { AnyToolDefinition } from "../registry";
import { readerOptions, uuid } from "./shared";

/**
 * Catalogue read tools — Module 37.
 *
 * All six take `catalog.read`, the key `/admin/products`,
 * `/admin/collections` and `/admin/builder` require.
 *
 * These read the ADMIN view of the catalogue — drafts and archived rows
 * included — which is correct for a staff assistant and is why they call
 * the admin readers rather than the storefront ones. The storefront
 * readers filter to published/active and are what the public site uses;
 * nothing here changes that.
 */

/**
 * The six builder option sets, as an enum of BUSINESS names.
 *
 * NOT table names. Master Build Plan 12B.15 permanently forbids "a tool
 * that takes a table name as an argument", and the underlying reader
 * `getAdminOptionRows(table)` takes exactly that — so the mapping lives
 * here, in the tool, and the closed enum is what the model sees. A caller
 * sending `products` or `profiles` gets a VALIDATION_ERROR from the
 * schema; no arbitrary table name can reach the query builder.
 */
export const OPTION_SETS = {
  fabric: "fabrics",
  embroidery: "embroidery_types",
  colour: "colours",
  sleeve: "sleeve_styles",
  neckline: "necklines",
  dupatta: "dupatta_options",
} as const satisfies Record<string, BuilderOptionTable>;

export type OptionSetKey = keyof typeof OPTION_SETS;

const OPTION_SET_KEYS = Object.keys(OPTION_SETS) as [OptionSetKey, ...OptionSetKey[]];

export const optionSetEnum = z
  .enum(OPTION_SET_KEYS)
  .describe("Which set of custom-builder options to read.");

const PRODUCT_STATUSES = ["draft", "published", "archived"] as const;

const productsList: AnyToolDefinition = {
  name: "products_list",
  title: "List products",
  description:
    "List catalogue products, newest first, optionally filtered by status. Includes drafts and " +
    "archived products, which the public storefront does not show. Reads only; it cannot create, " +
    "edit, publish or archive a product.",
  kind: "read",
  risk: "low",
  permission: "catalog.read",
  inputSchema: z
    .object({
      status: z
        .enum(PRODUCT_STATUSES)
        .optional()
        .describe("Only return products with this status. Omit for all statuses."),
      ...paginationShape,
    })
    .strict(),
  handler: async (input, ctx) => {
    const all = await getAdminProducts(readerOptions(ctx));
    const filtered = input.status ? all.filter((p) => p.status === input.status) : all;

    const page = paginate(
      filtered.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        status: product.status,
        price: Number(product.base_price),
        currency: product.currency,
        isFeatured: product.is_featured,
        createdAt: product.created_at,
      })),
      input
    );

    return {
      action: input.status ? `Listed ${input.status} products` : "Listed products",
      data: page,
    };
  },
};

const productsGet: AnyToolDefinition = {
  name: "products_get",
  title: "Get a product",
  description:
    "Get one catalogue product by its id, including its description and publication state. Reads " +
    "only; it cannot edit or publish a product.",
  kind: "read",
  risk: "low",
  permission: "catalog.read",
  inputSchema: z.object({ id: uuid("The product's id.") }).strict(),
  handler: async (input, ctx) => {
    const product = await getAdminProduct(input.id, readerOptions(ctx));
    if (!product) throw new McpError("NOT_FOUND", "That product could not be found.");

    return {
      action: "Retrieved product",
      target: { type: "product", id: product.id },
      data: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        description: product.description,
        status: product.status,
        price: Number(product.base_price),
        currency: product.currency,
        categoryId: product.category_id,
        isFeatured: product.is_featured,
        publishedAt: product.published_at,
        createdAt: product.created_at,
        updatedAt: product.updated_at,
      },
    };
  },
};

const collectionsList: AnyToolDefinition = {
  name: "collections_list",
  title: "List collections",
  description:
    "List catalogue collections, newest first, including inactive ones the storefront hides. " +
    "Reads only; it cannot create or edit a collection.",
  kind: "read",
  risk: "low",
  permission: "catalog.read",
  inputSchema: z.object({ ...paginationShape }).strict(),
  handler: async (input, ctx) => {
    const all = await getAdminCollections(readerOptions(ctx));
    const page = paginate(
      all.map((collection) => ({
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
        isActive: collection.is_active,
        isFeatured: collection.is_featured,
        publishedAt: collection.published_at,
        createdAt: collection.created_at,
      })),
      input
    );

    return { action: "Listed collections", data: page };
  },
};

const collectionsGet: AnyToolDefinition = {
  name: "collections_get",
  title: "Get a collection",
  description:
    "Get one catalogue collection by its id, including its description and cover image. Reads " +
    "only; it cannot edit a collection or change what is in it.",
  kind: "read",
  risk: "low",
  permission: "catalog.read",
  inputSchema: z.object({ id: uuid("The collection's id.") }).strict(),
  handler: async (input, ctx) => {
    const collection = await getAdminCollection(input.id, readerOptions(ctx));
    if (!collection) throw new McpError("NOT_FOUND", "That collection could not be found.");

    return {
      action: "Retrieved collection",
      target: { type: "collection", id: collection.id },
      data: {
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
        description: collection.description,
        coverImageUrl: collection.cover_image_url,
        isActive: collection.is_active,
        isFeatured: collection.is_featured,
        publishedAt: collection.published_at,
        createdAt: collection.created_at,
        updatedAt: collection.updated_at,
      },
    };
  },
};

/** Colour swaps `description` for `hex_value`; every other set shares one shape. */
function optionRow(row: Fabric | Colour) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: "description" in row ? row.description : null,
    hexValue: "hex_value" in row ? row.hex_value : null,
    imageUrl: row.image_url,
    priceAdjustment: Number(row.price_adjustment),
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

const builderOptionsList: AnyToolDefinition = {
  name: "builder_options_list",
  title: "List custom-builder options",
  description:
    "List the options available in the custom lehenga builder for one option set — fabric, " +
    "embroidery, colour, sleeve, neckline or dupatta. Includes inactive options the builder " +
    "hides from customers. Reads only; it cannot add, edit or deactivate an option.",
  kind: "read",
  risk: "low",
  permission: "catalog.read",
  inputSchema: z
    .object({
      optionSet: optionSetEnum,
      activeOnly: z
        .boolean()
        .default(false)
        .describe("Return only options currently offered to customers."),
      ...paginationShape,
    })
    .strict(),
  handler: async (input, ctx) => {
    const rows = await getAdminOptionRows<Fabric | Colour>(
      OPTION_SETS[input.optionSet as OptionSetKey],
      readerOptions(ctx)
    );
    const filtered = input.activeOnly ? rows.filter((row) => row.is_active) : rows;
    const page = paginate(filtered.map(optionRow), input);

    return { action: `Listed ${input.optionSet} options`, data: page };
  },
};

const builderOptionsGet: AnyToolDefinition = {
  name: "builder_options_get",
  title: "Get a custom-builder option",
  description:
    "Get one custom-builder option by its option set and id. Reads only; it cannot edit an option " +
    "or change its price adjustment.",
  kind: "read",
  risk: "low",
  permission: "catalog.read",
  inputSchema: z.object({ optionSet: optionSetEnum, id: uuid("The option's id.") }).strict(),
  handler: async (input, ctx) => {
    const row = await getAdminOptionRow<Fabric | Colour>(
      OPTION_SETS[input.optionSet as OptionSetKey],
      input.id,
      readerOptions(ctx)
    );
    if (!row) throw new McpError("NOT_FOUND", "That builder option could not be found.");

    return {
      action: `Retrieved ${input.optionSet} option`,
      target: { type: input.optionSet, id: row.id },
      data: optionRow(row),
    };
  },
};

export const catalogTools: AnyToolDefinition[] = [
  productsList,
  productsGet,
  collectionsList,
  collectionsGet,
  builderOptionsList,
  builderOptionsGet,
];

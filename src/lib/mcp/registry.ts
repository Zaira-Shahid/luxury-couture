import { z } from "zod";

import type { Permission } from "@/lib/auth/permissions";

import type { McpContext } from "./context";

/**
 * The tool registry (Master Build Plan section 12B.2).
 *
 * THIS IS THE FIRST OF THE TWO SECURITY BOUNDARIES. The dispatcher can
 * only reach a name that is registered here, so "what can the AI do" is
 * answerable by reading one list rather than by auditing a query builder.
 * There is no `execute_sql`, no tool that takes a table name, and no
 * escape hatch — adding a capability means adding a definition, in a
 * module, with a permission, with tests.
 *
 * The second boundary is RLS, which applies underneath every handler
 * because handlers use the caller's own Supabase client (see context.ts).
 * Neither boundary depends on the other being correct.
 */

export type ToolKind = "read" | "write";

/**
 * How much damage a mistaken call could do.
 *
 * `high` is the confirmation trigger: the tool will not execute on the
 * first call, only describe what it would do. See confirm.ts and section
 * 12B.6 for the list of actions that must be high.
 */
export type ToolRisk = "low" | "medium" | "high";

/** What a write changed, so the audit row points at a real record. */
export type ToolTarget = { type: string; id: string | null };

export type ToolHandlerResult = {
  /** Short human sentence naming what happened, e.g. "Product updated". */
  action: string;
  /** The structured payload returned to the caller. Must contain no secrets. */
  data: unknown;
  /** Write tools: the record touched, for `audit_logs`. */
  target?: ToolTarget;
};

export type ToolDefinition<TSchema extends z.ZodType = z.ZodType> = {
  /** `<domain>_<action>`, lower snake case. Section 12B.9. */
  name: string;
  title: string;
  /** Shown to the model. Say what it does AND what it refuses to do. */
  description: string;
  kind: ToolKind;
  risk: ToolRisk;
  /**
   * The permission key from the existing 23-key catalogue that a caller
   * must hold. `null` means "any admin role", which is only appropriate
   * for tools that expose nothing role-specific.
   *
   * No MCP-specific permission key exists on purpose: MCP is a second
   * doorway to capabilities the platform already models, so a new key
   * would describe a capability the admin UI cannot express.
   */
  permission: Permission | null;
  inputSchema: TSchema;
  /**
   * High-risk tools only: describe the pending change WITHOUT making it,
   * so the confirmation prompt can state the real blast radius ("this
   * will archive 24 products") rather than a guess.
   */
  describeImpact?: (input: z.infer<TSchema>, ctx: McpContext) => Promise<{
    summary: string;
    affectedRecords: number;
  }>;
  handler: (input: z.infer<TSchema>, ctx: McpContext) => Promise<ToolHandlerResult>;
};

/* eslint-disable-next-line @typescript-eslint/no-explicit-any --
   The registry is heterogeneous by nature: it holds tools whose input
   types all differ, and the type parameter is what makes each individual
   definition type-safe at its declaration site. Narrowing the stored type
   would force every call site to cast instead, moving the `any` from one
   place to many. */
export type AnyToolDefinition = ToolDefinition<any>;

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/;

/**
 * Rules a definition must satisfy, checked when the registry is built —
 * i.e. at import time, so a violation fails the build and the test run
 * rather than surfacing as a runtime surprise on a production call.
 */
function assertValidDefinition(tool: AnyToolDefinition): void {
  if (!TOOL_NAME_PATTERN.test(tool.name)) {
    throw new Error(
      `MCP tool "${tool.name}" does not follow the <domain>_<action> naming convention.`
    );
  }
  if (tool.kind === "write" && tool.permission === null) {
    throw new Error(`MCP write tool "${tool.name}" must declare a permission.`);
  }
  if (tool.risk === "high" && tool.kind !== "write") {
    throw new Error(`MCP tool "${tool.name}" is high risk but not a write tool.`);
  }
  if (tool.risk === "high" && !tool.describeImpact) {
    throw new Error(
      `MCP high-risk tool "${tool.name}" must implement describeImpact() so the ` +
        `confirmation prompt can state what would change.`
    );
  }
  if (!tool.description.trim()) {
    throw new Error(`MCP tool "${tool.name}" needs a description — the model reads it.`);
  }
}

export type ToolRegistry = {
  get(name: string): AnyToolDefinition | undefined;
  /** Every tool, unfiltered. For diagnostics and tests, never for a client. */
  all(): AnyToolDefinition[];
  /**
   * What a given permission set may call.
   *
   * A USABILITY measure, not the enforcement: `tools/call` re-checks the
   * permission regardless of what was listed, because a client can call a
   * name it was never shown. See section 12B.4.
   */
  visibleTo(permissions: Set<string>): AnyToolDefinition[];
};

export function buildRegistry(tools: AnyToolDefinition[]): ToolRegistry {
  const byName = new Map<string, AnyToolDefinition>();

  for (const tool of tools) {
    assertValidDefinition(tool);
    if (byName.has(tool.name)) {
      throw new Error(`MCP tool "${tool.name}" is registered twice.`);
    }
    byName.set(tool.name, tool);
  }

  return {
    get: (name) => byName.get(name),
    all: () => [...byName.values()],
    visibleTo: (permissions) =>
      [...byName.values()].filter((t) => t.permission === null || permissions.has(t.permission)),
  };
}

/**
 * The `tools/list` entry for one tool.
 *
 * The advertised schema is GENERATED from the Zod schema that validates
 * the call, so what the model is told and what the server enforces cannot
 * drift apart — the usual failure mode being a schema updated in one place
 * and not the other, which shows up as the model confidently sending a
 * field that is then rejected.
 *
 * `_meta` carries our own kind/risk so a client (and the Module 42 chat
 * UI) can tell a read from a write, and know which calls will come back
 * asking for confirmation, without hardcoding a list of tool names.
 */
export function describeTool(tool: AnyToolDefinition) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: z.toJSONSchema(tool.inputSchema, { target: "draft-7" }),
    annotations: {
      title: tool.title,
      readOnlyHint: tool.kind === "read",
      destructiveHint: tool.risk === "high",
    },
    _meta: {
      kind: tool.kind,
      risk: tool.risk,
      permission: tool.permission,
      confirmationRequired: tool.risk === "high",
    },
  };
}

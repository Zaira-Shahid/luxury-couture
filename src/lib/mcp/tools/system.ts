import { z } from "zod";

import { isAiConfigured } from "@/lib/ai";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { isEmailConfigured } from "@/lib/email";
import { isStripeConfigured } from "@/lib/payments";

import { MCP_PROTOCOL_VERSION, SERVER_INFO } from "../protocol";
import type { AnyToolDefinition } from "../registry";

/**
 * System tools — Module 36.
 *
 * SCOPE DISCIPLINE: these three are the only tools this module ships. The
 * MCP instruction says to implement only what the current module needs and
 * not to build future tools prematurely, so there is deliberately no
 * `products_list` here even though it would be easy — the catalogue tools
 * belong to Module 37 and arrive with their own tests.
 *
 * What these DO earn their place doing is proving the foundation end to
 * end against a real deployment: that the transport speaks the protocol,
 * that the registry dispatches, that a schema rejects bad input, that an
 * unauthenticated caller is refused, and that a permission gate actually
 * gates. `system_diagnostics` exists for the last of those as much as for
 * its output — without one permission-gated tool, Module 36 would ship an
 * authorization layer with nothing to test it against.
 */

const emptyInput = z.object({}).strict();

const ping: AnyToolDefinition = {
  name: "system_ping",
  title: "Ping",
  description:
    "Check that the assistant's connection to the Luxury Lehenga platform is working. " +
    "Returns the server time and protocol version. Reads nothing and changes nothing.",
  kind: "read",
  risk: "low",
  // Any admin role. It exposes no business data at all — only that the
  // endpoint is alive, which the caller already knows by reaching it.
  permission: null,
  inputSchema: emptyInput,
  handler: async (_input, ctx) => ({
    action: "Connection check",
    data: {
      ok: true,
      serverTime: ctx.now.toISOString(),
      protocolVersion: MCP_PROTOCOL_VERSION,
      server: SERVER_INFO.name,
    },
  }),
};

const whoami: AnyToolDefinition = {
  name: "system_whoami",
  title: "Who am I",
  description:
    "Report which staff account the assistant is acting for, their role, and exactly which " +
    "permissions they hold. Use this to explain why an action was refused rather than guessing. " +
    "Reads nothing and changes nothing.",
  kind: "read",
  risk: "low",
  // Any admin role: it returns the CALLER'S own identity and nobody
  // else's, so there is no permission that could sensibly gate it — and a
  // caller who cannot ask who they are cannot be told why they were
  // refused.
  permission: null,
  inputSchema: emptyInput,
  handler: async (_input, ctx) => ({
    action: "Identity check",
    data: {
      userId: ctx.actor.id,
      email: ctx.actor.email,
      role: ctx.actor.role,
      roleLabel: ROLE_LABELS[ctx.actor.role],
      // Sorted so the output is stable between calls — an assistant
      // comparing two responses should not see a spurious difference.
      permissions: [...ctx.actor.permissions].sort(),
    },
  }),
};

const diagnostics: AnyToolDefinition = {
  name: "system_diagnostics",
  title: "MCP diagnostics",
  description:
    "Report the state of the MCP layer itself: how many tools are registered, split by read/write " +
    "and risk, and which optional integrations are configured. Returns booleans only — it never " +
    "returns an API key, a credential or a connection string. Reads nothing and changes nothing.",
  kind: "read",
  risk: "low",
  // Deployment configuration is settings territory, and this is the same
  // information Admin -> Settings shows, so it takes the same key rather
  // than a new MCP-specific one.
  permission: "settings.manage",
  inputSchema: emptyInput,
  handler: async () => {
    // Imported at call time to keep this file free of a cycle: the
    // registry is assembled from these definitions, so importing it at
    // module scope would have tools/index.ts and this file each waiting
    // on the other.
    const { toolRegistry } = await import("./index");
    const tools = toolRegistry.all();

    return {
      action: "MCP diagnostics",
      data: {
        server: { name: SERVER_INFO.name, version: SERVER_INFO.version },
        protocolVersion: MCP_PROTOCOL_VERSION,
        registry: {
          total: tools.length,
          read: tools.filter((t) => t.kind === "read").length,
          write: tools.filter((t) => t.kind === "write").length,
          highRisk: tools.filter((t) => t.risk === "high").length,
          names: tools.map((t) => t.name).sort(),
        },
        // Booleans, never values. "Is Stripe configured" is operationally
        // useful; the key itself is never returned by any tool, and there
        // is no tool that can read an environment variable.
        integrations: {
          stripe: isStripeConfigured(),
          email: isEmailConfigured(),
          ai: isAiConfigured(),
        },
      },
    };
  },
};

export const systemTools: AnyToolDefinition[] = [ping, whoami, diagnostics];

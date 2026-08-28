/**
 * MCP wire protocol — the JSON-RPC 2.0 shapes this server speaks.
 *
 * DELIBERATELY HAND-ROLLED rather than pulling in @modelcontextprotocol/sdk.
 * The SDK's transports are stdio and a stateful SSE/streamable-HTTP session;
 * this deployment is a stateless Vercel route handler carrying a Supabase
 * session, so the SDK's session management is the part we would have to
 * fight. What we actually need is a dispatcher over five methods, and
 * writing those five is smaller than adapting a transport that assumes a
 * long-lived process. Master Build Plan section 12B.2.
 *
 * The surface is `tools/*` only. No resources, no prompts, no sampling,
 * no server-initiated requests — a client cannot ask this server to call
 * back into a model, so there is no path by which the AI could drive the
 * server rather than the other way round.
 */

/** The MCP revision this server implements. */
export const MCP_PROTOCOL_VERSION = "2025-06-18";

/**
 * Protocol revisions we will answer to. A client that asks for one of
 * these gets it echoed back; anything else is answered with our own
 * version, which is what the spec requires (the client then decides
 * whether it can proceed).
 */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

export const SERVER_INFO = {
  name: "luxury-couture-mcp",
  title: "Luxury Lehenga Couture",
  version: "1.0.0",
} as const;

/**
 * Advertised capabilities. `tools.listChanged: false` is honest: the
 * registry is static per deployment, so we never emit a change
 * notification and must not claim we might.
 */
export const SERVER_CAPABILITIES = {
  tools: { listChanged: false },
} as const;

/** Standard JSON-RPC 2.0 error codes. */
export const JSON_RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  /** Absent on a notification, which by spec MUST NOT be answered. */
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
};

export type JsonRpcFailure = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: { code: number; message: string; data?: unknown };
};

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

export function jsonRpcSuccess(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result };
}

export function jsonRpcFailure(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown
): JsonRpcFailure {
  return { jsonrpc: "2.0", id, error: data === undefined ? { code, message } : { code, message, data } };
}

/**
 * Shape-checks an incoming message. Returns null when it is not a
 * well-formed JSON-RPC 2.0 request, so the caller answers INVALID_REQUEST
 * rather than reading fields off whatever arrived.
 */
export function parseJsonRpcRequest(value: unknown): JsonRpcRequest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const message = value as Record<string, unknown>;
  if (message.jsonrpc !== "2.0") return null;
  if (typeof message.method !== "string" || !message.method) return null;

  const id = message.id;
  if (id !== undefined && typeof id !== "string" && typeof id !== "number" && id !== null) {
    return null;
  }

  const params = message.params;
  if (params !== undefined && (typeof params !== "object" || params === null || Array.isArray(params))) {
    return null;
  }

  return {
    jsonrpc: "2.0",
    ...(id === undefined ? {} : { id }),
    method: message.method,
    ...(params === undefined ? {} : { params: params as Record<string, unknown> }),
  };
}

/** A notification carries no id and therefore gets no response at all. */
export function isNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined;
}

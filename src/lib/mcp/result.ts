import type { McpError } from "./errors";
import type { ToolTarget } from "./registry";

/**
 * The result envelope (Master Build Plan sections 12B.8 and 15 of the MCP
 * instruction).
 *
 * Every tool call returns BOTH a short human-readable block and a
 * structured object. The text is what an assistant reads back to an
 * administrator; the structured half is what the Module 42 chat UI and any
 * programmatic client use. Returning only prose would force a client to
 * parse English to find a record id.
 *
 * NEVER REPORTS SUCCESS FOR SOMETHING THAT FAILED. `status` comes from the
 * code path taken, not from anything a handler or a model asserts, and a
 * failure always carries `isError` so a client that only inspects the
 * transport still sees it.
 */

type McpContentBlock = { type: "text"; text: string };

export type McpCallResult = {
  content: McpContentBlock[];
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};

function textBlock(lines: (string | null)[]): McpContentBlock[] {
  return [{ type: "text", text: lines.filter((line): line is string => line !== null).join("\n") }];
}

export function successResult(params: {
  action: string;
  data: unknown;
  target?: ToolTarget;
}): McpCallResult {
  const { action, data, target } = params;
  return {
    content: textBlock([
      `Action: ${action}`,
      "Status: SUCCESS",
      target?.id ? `Record: ${target.type} ${target.id}` : null,
      "",
      JSON.stringify(data, null, 2),
    ]),
    structuredContent: {
      status: "SUCCESS",
      action,
      ...(target ? { target } : {}),
      data,
    },
  };
}

/**
 * A refusal.
 *
 * "No changes were made." is stated explicitly rather than implied,
 * because the sentence an administrator most needs after a failed write is
 * the one confirming nothing half-happened. Every failure path in this
 * layer either occurs before the service call or is a database error that
 * rolled back, so the claim is true.
 */
export function errorResult(error: McpError, action: string): McpCallResult {
  return {
    content: textBlock([
      `Action: ${action}`,
      "Status: FAILED",
      `Reason: ${error.message}`,
      "No changes were made.",
    ]),
    structuredContent: {
      status: "FAILED",
      action,
      errorCode: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
    isError: true,
  };
}

/**
 * The response to a high-risk call that arrived without confirmation.
 *
 * This is NOT an error — nothing went wrong, and the action is still
 * available. It is a proposal, which is why it states the blast radius
 * before the token: the number of affected records is the fact that
 * changes an administrator's answer, and it must be visible without
 * reading the token or the arguments back.
 */
export function confirmationResult(params: {
  action: string;
  summary: string;
  affectedRecords: number;
  confirmationToken: string;
  expiresInSeconds: number;
}): McpCallResult {
  const { action, summary, affectedRecords, confirmationToken, expiresInSeconds } = params;
  return {
    content: textBlock([
      summary,
      "",
      `Affected records: ${affectedRecords}`,
      `Action: ${action}`,
      "Confirmation required: YES",
      "",
      `Nothing has changed yet. To go ahead, call this tool again with the same ` +
        `arguments plus confirmationToken (valid for ${Math.round(expiresInSeconds / 60)} minutes).`,
    ]),
    structuredContent: {
      status: "CONFIRMATION_REQUIRED",
      action,
      summary,
      affectedRecords,
      confirmationToken,
      expiresInSeconds,
    },
  };
}

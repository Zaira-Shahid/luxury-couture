import Anthropic from "@anthropic-ai/sdk";

import { logger } from "@/lib/logger";

import type { McpActor } from "./context";
import { handleJsonRpc, type McpServerDeps } from "./server";
import { describeTool, type AnyToolDefinition, type ToolRegistry } from "./registry";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The admin assistant loop — Module 42.
 *
 * THE MODEL NEVER HOLDS A CONFIRMATION TOKEN. This is the whole security
 * argument of this module and everything else follows from it.
 *
 * Module 36 made high-risk tools two-step: the first call returns a
 * proposal and a token, the second call spends the token and acts.
 * Handing both steps to the model would turn that ceremony into a
 * formality — it would read its own proposal, decide it looked fine, and
 * pass the token straight back. The "human confirmation step" the Master
 * Build Plan asks for would exist in the transcript and nowhere else.
 *
 * So the loop STOPS when a tool answers CONFIRMATION_REQUIRED. The
 * proposal goes to the person, the conversation is returned unfinished,
 * and only an explicit approval from the UI resumes it — with the server
 * supplying the token. `runAssistantTurn` cannot approve anything;
 * `resumeWithApproval` is a separate entry point that a human's click
 * reaches and a model's output cannot.
 *
 * EVERY TOOL CALL GOES THROUGH THE MCP DISPATCHER, not around it. The
 * loop builds a JSON-RPC `tools/call` and hands it to `handleJsonRpc()`,
 * exactly as the HTTP route does. Authorization, the permission check,
 * the replay ledger, the audit row, input redaction and the error model
 * all apply unchanged, because this is the same code path — a second
 * execution path would be a second security model, and only one of them
 * would get reviewed (12B.11).
 *
 * THE REGISTRY IS FILTERED BEFORE THE MODEL SEES IT. Claude is shown only
 * the tools this actor may use. Hiding a tool is not the enforcement —
 * the dispatcher still refuses it — but showing a model tools it cannot
 * use produces confident sentences about work that never happened.
 */

const MODEL = "claude-opus-5";

/** A conversation is a handful of tool calls; beyond this it is a loop. */
const MAX_ITERATIONS = 12;

/** Long enough for several tool round-trips, short enough to fail a hung request. */
const REQUEST_TIMEOUT_MS = 120_000;

export type AssistantMessage = Anthropic.MessageParam;

/** What a turn ends as. */
export type AssistantTurn =
  | { status: "answered"; messages: AssistantMessage[]; reply: string }
  | {
      status: "needs_confirmation";
      messages: AssistantMessage[];
      /** What the assistant said before it asked. May be empty. */
      reply: string;
      pending: PendingConfirmation;
    }
  | { status: "failed"; messages: AssistantMessage[]; reply: string; error: string };

/**
 * A high-risk action waiting on a person.
 *
 * The token is deliberately ABSENT. It is not carried here, not returned
 * to the browser and not shown to the model — the server re-requests a
 * fresh proposal when the human approves, and spends that one. A token
 * that reached the client would be a token an XSS could spend.
 */
export type PendingConfirmation = {
  toolUseId: string;
  tool: string;
  /** The dispatcher's own plain-language description of what would change. */
  summary: string;
  affectedRecords: number;
  /** Echoed back on approval so the resumed call is the one that was shown. */
  input: unknown;
};

export type AssistantDeps = {
  registry: ToolRegistry;
  actor: McpActor;
  supabase: SupabaseClient;
  client?: Anthropic;
};

const SYSTEM_PROMPT = `You are the assistant inside the admin dashboard of Luxury Lehenga Couture, a made-to-order bridal couture business. You are talking to a member of staff who is signed in.

WHAT YOU ARE FOR
Answer questions about the catalogue, orders, production, enquiries, customers and the shop's own numbers, and make changes when you are asked to. Use the tools — never guess at a figure, a status or a stock level you could look up. If a tool returns nothing, say so plainly rather than filling the gap.

WHAT YOU MUST NOT DO
Do not claim to have done something you have not done. If a tool call fails or is refused, say what happened in plain words — the person can act on "you do not have permission to publish products", and cannot act on a confident sentence about a change that never happened.

Do not describe a tool result as more certain than it is. "Three orders are awaiting payment" is a claim about the moment you asked.

Some actions need a person to approve them before they happen. When one does, you will be told, and the person will be shown exactly what would change. Do not try to approve it yourself, do not repeat the request hoping it goes through, and do not tell the person it is done. Wait.

You cannot see anything the signed-in person cannot see. If a tool refuses on permissions, that is the answer — do not look for another route to the same data.

HOW TO WRITE
Talk like a colleague, not a report. Short sentences. Give the number and what it means, not a restatement of the question. When you list records, give the few fields that matter for what was asked rather than everything a tool returned. No preamble about what you are about to do.`;

/**
 * The registry, as Claude's tool definitions.
 *
 * The advertised JSON Schema is the tool's OWN schema — the same one
 * `tools/list` publishes over MCP. Building a second description here
 * would let the two drift, and the model would be told a shape the
 * dispatcher then rejects.
 */
function toAnthropicTools(registry: ToolRegistry, actor: McpActor): Anthropic.Tool[] {
  return registry.visibleTo(actor.permissions).map((tool: AnyToolDefinition) => {
    const described = describeTool(tool);
    return {
      name: described.name,
      description: described.description,
      input_schema: described.inputSchema as Anthropic.Tool.InputSchema,
    };
  });
}

/** One `tools/call` through the real dispatcher. */
async function dispatch(
  tool: string,
  input: unknown,
  deps: McpServerDeps
): Promise<Record<string, unknown>> {
  const response = await handleJsonRpc(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool, arguments: (input ?? {}) as Record<string, unknown> },
    },
    deps
  );

  // A JSON-RPC-level error (unknown tool, malformed params) rather than a
  // tool-level failure. Both must reach the model as text it can act on:
  // an unreported refusal is how an assistant ends up claiming success.
  if (response && "error" in response && response.error) {
    return { status: "FAILED", errorCode: "INVALID_REQUEST", message: response.error.message };
  }

  const structured =
    response && "result" in response
      ? ((response.result as { structuredContent?: Record<string, unknown> })?.structuredContent ??
        null)
      : null;

  return structured ?? { status: "FAILED", errorCode: "INTERNAL_ERROR", message: "No result." };
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) {
    return "The assistant is busy. Try again in a moment.";
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return "The assistant is not configured. Check the API key.";
  }
  if (error instanceof Anthropic.APIError) {
    return "The assistant could not be reached. Try again.";
  }
  return "Something went wrong. Nothing was changed.";
}

/**
 * Runs one turn: the person's message in, an answer or a confirmation
 * request out.
 *
 * `history` is the conversation so far, in Anthropic's own message shape.
 * It is passed in and returned rather than stored, because the session is
 * the browser's — nothing here writes a transcript to the database, so
 * there is no second copy of a conversation that may quote order values
 * and customer names.
 */
export async function runAssistantTurn(
  history: AssistantMessage[],
  userMessage: string,
  deps: AssistantDeps
): Promise<AssistantTurn> {
  const client = deps.client ?? new Anthropic({ timeout: REQUEST_TIMEOUT_MS });
  const serverDeps: McpServerDeps = {
    registry: deps.registry,
    actor: deps.actor,
    supabase: deps.supabase,
  };

  const tools = toAnthropicTools(deps.registry, deps.actor);
  const messages: AssistantMessage[] = [...history, { role: "user", content: userMessage }];

  let lastText = "";

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        // Adaptive thinking: choosing which of fifty tools answers a
        // vague question benefits from it, and a lookup does not pay for
        // what it does not use.
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });
    } catch (error) {
      logger.error("assistant turn failed", error, { actorId: deps.actor.id });
      return { status: "failed", messages, reply: lastText, error: describeError(error) };
    }

    const text = textOf(response);
    if (text) lastText = text;

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      return { status: "answered", messages, reply: lastText };
    }

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    const results: Anthropic.ToolResultBlockParam[] = [];

    for (const use of toolUses) {
      const result = await dispatch(use.name, use.input, serverDeps);

      // THE STOP. A high-risk tool has described what it would do and
      // changed nothing. The loop ends here and a person decides — see
      // the file header for why this cannot be delegated to the model.
      if (result.status === "CONFIRMATION_REQUIRED") {
        // The model is told, in the same breath, that it is waiting.
        // Without a tool_result for every tool_use the conversation is
        // malformed and cannot be resumed at all.
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content:
            "This action needs a person to approve it. It has NOT been done. " +
            "The approval request is now in front of them. Tell them what you have asked to do and stop.",
        });

        // Every other call in this batch still gets a result, so the
        // conversation stays well-formed if the human approves later.
        for (const other of toolUses) {
          if (other.id === use.id) continue;
          if (results.some((r) => r.tool_use_id === other.id)) continue;
          results.push({
            type: "tool_result",
            tool_use_id: other.id,
            content: "Not run — the assistant is waiting for approval of another action.",
          });
        }

        messages.push({ role: "user", content: results });

        return {
          status: "needs_confirmation",
          messages,
          reply: lastText,
          pending: {
            toolUseId: use.id,
            tool: use.name,
            summary: String(result.summary ?? "This action needs approval."),
            affectedRecords: Number(result.affectedRecords ?? 0),
            input: use.input,
          },
        };
      }

      results.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: JSON.stringify(result),
        // Marked so the model treats a refusal as a refusal rather than
        // as data. 12B.8: never report success for something that failed.
        is_error: result.status === "FAILED",
      });
    }

    messages.push({ role: "user", content: results });
  }

  // Out of iterations rather than out of things to say. Reported as a
  // failure, because a truncated agentic run that reads as an answer is
  // exactly the shape of a confident wrong result.
  return {
    status: "failed",
    messages,
    reply: lastText,
    error: "The assistant took too many steps without finishing. Nothing further was done.",
  };
}

/**
 * Runs the approved action, then lets the assistant carry on.
 *
 * SEPARATE ENTRY POINT ON PURPOSE. Nothing the model emits can reach this
 * function; only a person clicking Approve can. The server asks the
 * dispatcher for a fresh proposal, takes the token from that reply and
 * spends it immediately — so the token exists for one server-side moment
 * and never crosses the network to the browser.
 *
 * The input is the one the human was SHOWN, echoed back from `pending`.
 * Re-deriving it from the conversation would let a later assistant turn
 * change what gets executed after the approval was given.
 */
export async function resumeWithApproval(
  messages: AssistantMessage[],
  pending: PendingConfirmation,
  deps: AssistantDeps
): Promise<AssistantTurn> {
  const serverDeps: McpServerDeps = {
    registry: deps.registry,
    actor: deps.actor,
    supabase: deps.supabase,
  };

  // REFUSE BEFORE DISPATCHING, not after. `pending` comes back from the
  // browser, and dispatching whatever tool it names would EXECUTE a
  // low-risk write on the way to discovering it never needed approval —
  // and then report "nothing was changed", which would be false. Only a
  // tool the registry itself calls high-risk can be approved, because
  // only those refuse to act on their first call.
  const definition = deps.registry.get(pending.tool);
  if (!definition || definition.risk !== "high") {
    return {
      status: "failed",
      messages,
      reply: "",
      error: "That action is not one that can be approved. Nothing was changed.",
    };
  }

  const proposal = await dispatch(pending.tool, pending.input, serverDeps);

  if (proposal.status !== "CONFIRMATION_REQUIRED" || !proposal.confirmationToken) {
    // The action stopped needing confirmation between the ask and the
    // approval — the record changed, or somebody else did it. Refusing is
    // the safe reading: the person approved a description that no longer
    // matches.
    return {
      status: "failed",
      messages,
      reply: "",
      error: "That action could not be confirmed. Nothing was changed — ask again.",
    };
  }

  const executed = await dispatch(
    pending.tool,
    { ...(pending.input as Record<string, unknown>), confirmationToken: proposal.confirmationToken },
    serverDeps
  );

  // The result is fed back as the tool_result the waiting conversation
  // never got, so the assistant can report what happened in its own
  // words rather than the UI inventing a sentence.
  const resumed: AssistantMessage[] = [
    ...messages,
    {
      role: "user",
      content:
        executed.status === "SUCCESS"
          ? `The person approved that action and it has now been done. Result: ${JSON.stringify(executed)}. Tell them briefly what changed.`
          : `The person approved that action but it FAILED: ${JSON.stringify(executed)}. Tell them plainly that it did not happen.`,
    },
  ];

  const client = deps.client ?? new Anthropic({ timeout: REQUEST_TIMEOUT_MS });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools: toAnthropicTools(deps.registry, deps.actor),
      messages: resumed,
    });

    resumed.push({ role: "assistant", content: response.content });
    return { status: "answered", messages: resumed, reply: textOf(response) };
  } catch (error) {
    logger.error("assistant resume failed", error, { actorId: deps.actor.id });
    // The ACTION already happened; only the sentence about it failed.
    // Saying "nothing was changed" here would be the inverse of 12B.8.
    return {
      status: "answered",
      messages: resumed,
      reply:
        executed.status === "SUCCESS"
          ? "That action was completed. (The assistant could not be reached to describe it.)"
          : "That action failed and nothing was changed.",
    };
  }
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { AssistantMessage, AssistantTurn, PendingConfirmation } from "@/lib/mcp/chat";

/**
 * The admin chat (Module 42).
 *
 * TYPE-ONLY IMPORT of the assistant module. `import type` is erased at
 * compile time, so the Anthropic SDK and the whole MCP server stay on the
 * server where they belong — this component ships the conversation SHAPE,
 * not the code that produces it.
 *
 * THE TRANSCRIPT SHOWS TOOL CALLS. Every call the model made is listed
 * under the answer that used it, with its arguments available on demand.
 * An assistant that reports a figure without saying where it came from is
 * asking to be trusted; this one says which tool it read, and the audit
 * table has the same call recorded server-side either way.
 *
 * TOOL RESULTS ARE NOT RENDERED AS JSON. The model's prose is the
 * plain-language rendering the Master Build Plan asks for — a dump of the
 * structured result underneath it would be the raw material the sentence
 * was made from, shown twice.
 */

type ToolCall = { id: string; name: string; input: unknown };

type Entry =
  | { kind: "person"; text: string }
  | { kind: "assistant"; text: string; tools: ToolCall[] };

/**
 * Turns the API conversation into something readable.
 *
 * The `user` messages carrying tool_result blocks are the loop's own
 * plumbing rather than anything a person said, so they are dropped: the
 * transcript should read as the conversation that happened.
 */
function toEntries(messages: AssistantMessage[]): Entry[] {
  const entries: Entry[] = [];

  for (const message of messages) {
    if (typeof message.content === "string") {
      if (message.role === "user") entries.push({ kind: "person", text: message.content });
      else entries.push({ kind: "assistant", text: message.content, tools: [] });
      continue;
    }

    let text = "";
    const tools: ToolCall[] = [];
    let isPlumbing = false;

    for (const block of message.content) {
      if (block.type === "text") text += (text ? "\n\n" : "") + block.text;
      else if (block.type === "tool_use")
        tools.push({ id: block.id, name: block.name, input: block.input });
      else if (block.type === "tool_result") isPlumbing = true;
    }

    if (isPlumbing) continue;
    if (!text && tools.length === 0) continue;

    entries.push(
      message.role === "user" ? { kind: "person", text } : { kind: "assistant", text, tools }
    );
  }

  return entries;
}

/** `products_publish` -> `products publish`, for a sentence rather than an identifier. */
function readableToolName(name: string) {
  return name.replace(/_/g, " ");
}

export function AssistantChat({ configured }: { configured: boolean }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const entries = useMemo(() => toEntries(messages), [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length, pending, busy]);

  const applyTurn = useCallback((turn: AssistantTurn) => {
    setMessages(turn.messages ?? []);
    setPending(turn.status === "needs_confirmation" ? turn.pending : null);
    setError(turn.status === "failed" ? turn.error : null);
  }, []);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const turn = (await response.json()) as AssistantTurn & { error?: string };

        // A rejected request (rate limit, sign-in, no key) has no
        // conversation in it — keep the one on screen and show why.
        if (!response.ok) {
          setError(turn.error ?? "The assistant could not be reached.");
          return;
        }
        applyTurn(turn);
      } catch {
        setError("The assistant could not be reached. Your work is unaffected.");
      } finally {
        setBusy(false);
      }
    },
    [applyTurn]
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    await post({ message: text, messages });
  }, [busy, draft, messages, post]);

  async function approve() {
    if (!pending || busy) return;
    // Cleared straight away so a second click cannot spend it twice; the
    // ledger would refuse the replay anyway, but the person should not be
    // shown a button that looks live while the first approval is running.
    const confirmed = pending;
    setPending(null);
    await post({ approve: confirmed, messages });
  }

  function reject() {
    setPending(null);
    setMessages((current) => [
      ...current,
      { role: "user", content: "I did not approve that. Do not do it." },
    ]);
  }

  if (!configured) {
    return (
      <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        The assistant needs an Anthropic API key. Set <code>ANTHROPIC_API_KEY</code> on this
        deployment and reload — nothing else on the dashboard is affected.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex min-h-[24rem] flex-col gap-4 rounded-lg border bg-card p-4"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {entries.length === 0 ? (
          <p className="m-auto max-w-md text-center text-sm text-muted-foreground">
            Ask about the catalogue, orders, production, enquiries or the shop&apos;s numbers.
            Changes that matter will be shown to you for approval before anything happens.
          </p>
        ) : null}

        {entries.map((entry, index) => (
          <div
            key={index}
            className={cn(
              "max-w-[46rem] rounded-lg px-4 py-3 text-sm",
              entry.kind === "person"
                ? "ml-auto bg-primary text-primary-foreground"
                : "mr-auto bg-muted text-foreground"
            )}
          >
            <p className="whitespace-pre-wrap">{entry.text}</p>

            {entry.kind === "assistant" && entry.tools.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1 border-t pt-2">
                {entry.tools.map((tool) => (
                  <li key={tool.id}>
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Used {readableToolName(tool.name)}</summary>
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded bg-background p-2">
                        {JSON.stringify(tool.input, null, 2)}
                      </pre>
                    </details>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}

        {pending ? (
          <div className="mr-auto max-w-[46rem] rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <h2 className="text-sm font-semibold">This needs your approval</h2>
            <p className="mt-1 text-sm">{pending.summary}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {readableToolName(pending.tool)} &middot;{" "}
              {pending.affectedRecords === 1
                ? "1 record would change"
                : `${pending.affectedRecords} records would change`}
              . Nothing has happened yet.
            </p>
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" onClick={approve} disabled={busy}>
                Approve and run
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={reject} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {busy ? <p className="text-sm text-muted-foreground">Working…</p> : null}
        <div ref={endRef} />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor="assistant-message" className="text-sm font-medium">
          Message
        </label>
        <Textarea
          id="assistant-message"
          value={draft}
          maxLength={2000}
          rows={3}
          disabled={busy}
          placeholder="How many orders are awaiting payment?"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line — the convention
            // for a chat box, and the button stays for anyone who expects
            // a form to need one.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            The assistant can only see and change what your account can.
          </p>
          <Button type="submit" disabled={busy || !draft.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

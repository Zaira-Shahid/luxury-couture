"use client";

import { MessageCircle, Send, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The customer assistant (Module 23).
 *
 * Two things about this UI are safety decisions, not styling:
 *
 *  - **Product suggestions render as cards built from database rows**
 *    returned by the API, never from model prose. The assistant cannot
 *    show a piece that does not exist, because it never writes the list.
 *  - **A human handoff is always one click away**, and it is offered
 *    prominently whenever the assistant could not answer. The failure
 *    mode we design for is "I don't know" reaching a real person quickly,
 *    not a confident guess.
 *
 * The transcript lives in component state only — nothing is read back
 * from the server, so a visitor's conversation is never exposed to
 * another visitor.
 */

type ChatProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  imageUrl: string | null;
};

type Turn = {
  role: "user" | "assistant";
  content: string;
  products?: ChatProduct[];
  showHandoff?: boolean;
};

const GREETING: Turn = {
  role: "assistant",
  content:
    "Hello! I can answer questions about ordering, measurements, fittings and delivery, or help you find a piece for your occasion. What can I help with?",
};

const SUGGESTIONS = [
  "How does ordering work?",
  "Something for a mehndi",
  "How do I give my measurements?",
];

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

/** One id per conversation. Not the cart or analytics session — this is functional and consent-free. */
function useSessionId() {
  const ref = useRef<string>("");
  if (!ref.current) {
    ref.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return ref.current;
}

export function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([GREETING]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const sessionId = useSessionId();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, isOpen]);

  function send(text: string) {
    const message = text.trim();
    if (!message || isPending) return;

    setTurns((prev) => [...prev, { role: "user", content: message }]);
    setInput("");

    startTransition(async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, sessionId }),
        });
        const data = (await res.json()) as {
          reply?: string;
          products?: ChatProduct[];
          unanswered?: boolean;
          error?: string;
        };

        setTurns((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data.reply ??
              data.error ??
              "Something went wrong. Please use the contact form and our team will help.",
            products: data.products ?? [],
            showHandoff: data.unanswered ?? false,
          },
        ]);
      } catch {
        setTurns((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I couldn't reach our system just then. Please use the contact form and our team will get back to you.",
            showHandoff: true,
          },
        ]);
      }
    });
  }

  return (
    <div className="fixed right-4 bottom-4 z-50">
      {isOpen ? (
        <div className="mb-3 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col rounded-xl bg-card shadow-lg ring-1 ring-foreground/10">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-heading text-lg">Ask us anything</p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {turns.map((turn, index) => (
              <div key={index}>
                <div
                  className={
                    turn.role === "user"
                      ? "ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "w-fit max-w-[90%] rounded-lg bg-muted px-3 py-2 text-sm"
                  }
                >
                  {turn.content}
                </div>

                {turn.products && turn.products.length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {turn.products.map((product) => (
                      <Link
                        key={product.id}
                        href={`/products/${product.slug}`}
                        className="group block overflow-hidden rounded-lg border border-border"
                      >
                        <div className="aspect-[3/4] bg-muted">
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="size-full bg-gradient-to-br from-secondary to-muted" />
                          )}
                        </div>
                        <div className="p-2">
                          <p className="line-clamp-2 text-xs group-hover:underline">
                            {product.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatPrice(product.price, product.currency)}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}

                {turn.showHandoff ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href="/contact"
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted"
                    >
                      Message our team
                    </Link>
                    <Link
                      href="/builder"
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted"
                    >
                      Design your own
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}

            {isPending ? (
              <p className="text-xs text-muted-foreground" role="status">
                Thinking…
              </p>
            ) : null}

            {turns.length === 1 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question…"
              maxLength={500}
              aria-label="Your message"
              className="h-9 text-sm"
            />
            <Button type="submit" size="icon" disabled={isPending || !input.trim()}>
              <Send className="size-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>

          <p className="px-3 pb-3 text-[11px] leading-snug text-muted-foreground">
            Automated assistant. It can&apos;t confirm prices, dates or order status —{" "}
            <Link href="/contact" className="underline hover:text-foreground">
              message our team
            </Link>{" "}
            for those.
          </p>
        </div>
      ) : null}

      <Button
        type="button"
        size="icon-lg"
        className="rounded-full shadow-lg"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? <X /> : <MessageCircle />}
      </Button>
    </div>
  );
}

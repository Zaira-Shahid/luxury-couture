"use client";

import { MessageCircle, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitEnquiry } from "@/features/contact/actions";

/**
 * Free-first default chat provider — a compose form that submits straight
 * into `enquiries`, standing in for a real live-chat widget (Tawk.to,
 * Crisp, Intercom, …) without needing a paid service in development. Swap
 * for a real provider by changing what ChatWidget (lib/chat/index.tsx)
 * renders, not by touching where it's mounted.
 */
export function MockChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("message", `[Live Chat] ${formData.get("message")}`);
    startTransition(async () => {
      const result = await submitEnquiry(formData);
      if ("error" in result) setError(result.error);
      else setSent(true);
    });
  }

  return (
    <div className="fixed right-4 bottom-4 z-50">
      {isOpen ? (
        <div className="mb-3 w-80 rounded-xl bg-card p-4 shadow-lg ring-1 ring-foreground/10">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-heading text-lg">Chat with us</p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          {sent ? (
            <p className="text-sm text-muted-foreground">
              Thanks — we&apos;ve received your message and will reply by email shortly.
            </p>
          ) : (
            <form action={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="chat-name" className="text-xs">
                  Name
                </Label>
                <Input id="chat-name" name="contactName" required className="h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="chat-email" className="text-xs">
                  Email
                </Label>
                <Input id="chat-email" name="contactEmail" type="email" required className="h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="chat-message" className="text-xs">
                  Message
                </Label>
                <Textarea id="chat-message" name="message" rows={3} required className="text-sm" />
              </div>
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Sending…" : "Send"}
              </Button>
            </form>
          )}
        </div>
      ) : null}
      <Button
        type="button"
        size="icon-lg"
        className="rounded-full shadow-lg"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Open chat"
      >
        {isOpen ? <X /> : <MessageCircle />}
      </Button>
    </div>
  );
}

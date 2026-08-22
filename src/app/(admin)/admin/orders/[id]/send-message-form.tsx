"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateEmailDraft } from "@/features/admin-ai/actions";
import { sendCustomerMessage } from "@/features/admin-orders/actions";

/**
 * Title and body became controlled state in Module 22 so the AI draft can
 * populate them. The draft only ever fills these fields — sending is
 * still the existing, separately-validated sendCustomerMessage action,
 * triggered by the admin, so nothing reaches a customer unreviewed.
 */
export function SendMessageForm({
  orderId,
  orderNumber,
  orderStatus,
  customerName,
}: {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  customerName: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [isDrafting, startDrafting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [intent, setIntent] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSent(false);
    startTransition(async () => {
      const result = await sendCustomerMessage(orderId, formData);
      if ("error" in result) setError(result.error);
      else {
        setSent(true);
        setTitle("");
        setBody("");
        setIntent("");
        setWarnings([]);
      }
    });
  }

  function handleDraft() {
    setError(null);
    setWarnings([]);
    startDrafting(async () => {
      const formData = new FormData();
      formData.set("orderNumber", orderNumber);
      formData.set("orderStatus", orderStatus);
      formData.set("intent", intent);
      if (customerName) formData.set("customerName", customerName);

      const result = await generateEmailDraft(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setTitle(result.subject);
      setBody(result.body);
      setWarnings(result.warnings);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border p-3">
        <Label htmlFor="ai-intent" className="text-xs">
          Draft with AI (optional)
        </Label>
        <p className="mt-1 mb-2 text-xs text-muted-foreground">
          Say what you want to tell the customer and we&apos;ll draft it. Drafts never state prices,
          dates or order status — review before sending.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="ai-intent"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="e.g. their fabric choice is confirmed and work has begun"
            className="h-9 text-sm"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleDraft}
            disabled={isDrafting || !intent.trim()}
            className="shrink-0"
          >
            <Sparkles className="size-3.5" />
            {isDrafting ? "Drafting…" : "Draft"}
          </Button>
        </div>
      </div>

      <form action={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            name="body"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </div>
        {warnings.map((warning) => (
          <p key={warning} className="text-xs text-muted-foreground">
            {warning}
          </p>
        ))}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {sent ? <p className="text-sm text-primary">Sent to the customer.</p> : null}
        <Button type="submit" size="sm" disabled={isPending} className="w-fit">
          {isPending ? "Sending…" : "Send Message"}
        </Button>
      </form>
    </div>
  );
}

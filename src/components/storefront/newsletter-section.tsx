"use client";

import { useRef, useState, useTransition } from "react";

import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeToNewsletter } from "@/features/marketing/actions";

export function NewsletterSection() {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await subscribeToNewsletter(formData);
      if ("error" in result) {
        setState("error");
        setError(result.error);
      } else {
        setState("success");
        formRef.current?.reset();
      }
    });
  }

  return (
    <section className="container py-20">
      <ScrollReveal className="mx-auto max-w-md text-center">
        <h2 className="font-heading text-3xl sm:text-4xl">Stay in Touch</h2>
        <p className="mt-3 text-muted-foreground">
          New collections, private previews, and styling notes — no spam.
        </p>
        {state === "success" ? (
          <p className="mt-6 text-sm text-primary">You&apos;re on the list. Thank you.</p>
        ) : (
          <form ref={formRef} action={handleSubmit} className="mt-6 flex gap-2">
            <Input
              type="email"
              name="email"
              placeholder="you@example.com"
              required
              aria-label="Email address"
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Joining…" : "Join"}
            </Button>
          </form>
        )}
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </ScrollReveal>
    </section>
  );
}

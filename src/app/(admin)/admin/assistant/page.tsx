import type { Metadata } from "next";

import { AssistantChat } from "@/components/admin/assistant-chat";
import { isAiConfigured } from "@/lib/ai";
import { getMyPermissions } from "@/lib/auth/session";
import { toolRegistry } from "@/lib/mcp/tools";

export const metadata: Metadata = { title: "Assistant" };

/**
 * The admin assistant screen (Module 42).
 *
 * NO PERMISSION GATE ON THE PAGE ITSELF, deliberately. Every tool carries
 * its own permission and the dispatcher enforces it on each call, so a
 * marketing account opening this screen gets an assistant that can read
 * the blog and cannot touch an order. Gating the page on some single
 * permission would either lock out staff who have legitimate use of a
 * subset of the tools, or imply an authority the page does not grant.
 *
 * The count below is honest about that: it is what THIS person's account
 * can reach, computed from the same registry filter the model is given.
 */
export default async function AdminAssistantPage() {
  const permissions = await getMyPermissions();
  const available = toolRegistry.visibleTo(permissions).length;
  const total = toolRegistry.all().length;

  return (
    <div className="container flex flex-col gap-6 py-10">
      <div>
        <h1 className="font-heading text-2xl">Assistant</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Ask about the shop and make changes in plain English. Your account can use{" "}
          {available} of the {total} available tools, and anything that would change records at
          scale is shown to you for approval before it runs.
        </p>
      </div>

      <AssistantChat configured={isAiConfigured()} />
    </div>
  );
}

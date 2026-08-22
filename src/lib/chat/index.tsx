import { AssistantWidget } from "@/components/chat/assistant-widget";
import { MockChatWidget } from "@/components/chat/mock-chat-widget";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

/**
 * Provider abstraction, same pattern as payments/notifications/shipping/AI
 * (Master Build Plan §3, free-first): one mount point, swappable
 * implementation.
 *
 * Module 23 made `assistant` the default — the FAQ chatbot and product
 * discovery built on Module 22's AI engine. This is exactly what Module
 * 9 built this seam for ("swap what ChatWidget renders, not where it's
 * mounted"), so nothing at the mount site changed.
 *
 * `CHAT_PROVIDER=mock` still selects the original compose-an-enquiry
 * form. Keep it: it is the fallback if the assistant ever needs to be
 * switched off in a hurry, and it is what a real third-party live-chat
 * provider would slot in beside.
 */
export async function ChatWidget() {
  // Module 25: an admin can switch the assistant off entirely. Checked
  // here rather than inside the widget so a disabled assistant ships no
  // markup and no client JS at all, instead of rendering and hiding.
  const settings = await getSiteSettings();
  if (!settings.ai.assistantEnabled) return null;

  const provider = process.env.CHAT_PROVIDER ?? "assistant";

  switch (provider) {
    case "mock":
      return <MockChatWidget />;
    case "assistant":
    default:
      return <AssistantWidget />;
  }
}

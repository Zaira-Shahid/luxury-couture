import { MockChatWidget } from "@/components/chat/mock-chat-widget";

/**
 * Provider abstraction, same pattern as payments/notifications/shipping/AI
 * (Master Build Plan §3, free-first): one mount point, swappable
 * implementation. Defaults to the free mock widget; set CHAT_PROVIDER to
 * switch without touching wherever ChatWidget is mounted.
 */
export function ChatWidget() {
  const provider = process.env.CHAT_PROVIDER ?? "mock";

  switch (provider) {
    case "mock":
    default:
      return <MockChatWidget />;
  }
}

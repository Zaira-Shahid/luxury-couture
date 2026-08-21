import { logger } from "@/lib/logger";

/**
 * For development, use mock/local notification providers (Master Build
 * Plan §15) — no real email/WhatsApp provider credentials exist to
 * integrate against, same deferral shape as Modules 11/14's PayPal/
 * courier decisions. These just log clearly-tagged mock deliveries.
 */
export function sendMockEmail(to: string, subject: string, body: string) {
  logger.info("[mock email]", { to, subject, body });
}

export function sendMockWhatsApp(to: string, body: string) {
  logger.info("[mock whatsapp]", { to, body });
}

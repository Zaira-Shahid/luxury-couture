import { logger } from "@/lib/logger";

import type { EmailMessage, EmailProvider, EmailResult } from "./provider";

/**
 * The default provider. Logs instead of sending, so the whole application
 * works with no credentials and no cost — the same free-first stance
 * lib/payments takes with ManualProvider.
 *
 * Logs the plain-text body rather than the HTML: the HTML is a wall of
 * table markup that would drown the log, and the text alternative carries
 * the same content in a readable form.
 */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock";

  async send(message: EmailMessage): Promise<EmailResult> {
    logger.info("[mock email]", {
      to: message.to,
      subject: message.subject,
      kind: message.kind,
      template: message.templateKey,
      // Truncated: enough to confirm the right content without flooding.
      preview: message.text.slice(0, 400),
      ...(message.kind === "marketing" ? { unsubscribeUrl: message.unsubscribeUrl } : {}),
    });
    return { ok: true, providerId: null };
  }
}

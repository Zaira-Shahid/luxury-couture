import { logger } from "@/lib/logger";

import type { EmailMessage, EmailProvider, EmailResult } from "./provider";

/**
 * Resend, via plain `fetch` against its REST API — deliberately no SDK
 * and no new dependency. The request is three headers and a JSON body;
 * pulling in a package for that would be weight without benefit, and the
 * project already talks to Stripe through its SDK only because signature
 * verification genuinely needs one.
 *
 * Active only when RESEND_API_KEY is set, mirroring isStripeConfigured().
 *
 * NOT VERIFIED against the live API — no key exists in this environment,
 * the same deferral Modules 11/14/22 made for PayPal, couriers and
 * Claude. The request shape follows Resend's documented API; the failure
 * paths are tested with an injected failing fetch.
 */

const ENDPOINT = "https://api.resend.com/emails";
/** An email send should not hold a Server Action open indefinitely. */
const TIMEOUT_MS = 15_000;

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    /** Injectable so tests can supply a failing fetch without a real key. */
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let response: Response;
      try {
        response = await this.fetchImpl(ENDPOINT, {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: this.from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
            // RFC 8058: gives Gmail/Apple Mail a native one-click
            // unsubscribe button. Marketing only — adding it to a
            // transactional email invites people to opt out of their own
            // order updates.
            ...(message.kind === "marketing"
              ? {
                  headers: {
                    "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                  },
                }
              : {}),
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        logger.warn("resend send failed", {
          status: response.status,
          to: message.to,
          template: message.templateKey,
        });
        return { ok: false, error: `resend ${response.status}: ${detail.slice(0, 200)}` };
      }

      const body = (await response.json().catch(() => ({}))) as { id?: string };
      return { ok: true, providerId: body.id ?? null };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logger.warn("resend send threw", { to: message.to, message: detail });
      return { ok: false, error: detail };
    }
  }
}

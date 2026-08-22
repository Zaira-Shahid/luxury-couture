import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

import { getEmailProvider } from "./index";
import type { EmailMessage, EmailResult } from "./provider";

/**
 * The single send path. Everything that emails a customer goes through
 * here, so the delivery record and the marketing rule are enforced in
 * one place.
 *
 * NOTE FOR FUTURE MODULES: Module 22's `applyGuardrails` must NOT be
 * applied to these messages. Guardrails redact every price, date and
 * order-status claim — correct for AI-generated prose, wrong here. An
 * order confirmation stating the real amount the customer actually paid
 * is exactly what it should do. Guardrails guard *invented* text; these
 * templates render *stored* facts.
 *
 * Never throws. A bounced confirmation must not roll back the order that
 * triggered it, so failures are recorded and returned, not raised.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  // Belt and braces alongside the type: a marketing message assembled
  // from untyped data (a campaign row, a JSON payload) could still reach
  // here with an empty URL, and an unsubscribe link that goes nowhere is
  // as non-compliant as none at all.
  if (message.kind === "marketing" && !message.unsubscribeUrl?.trim()) {
    const error = "refusing to send a marketing email without an unsubscribe URL";
    logger.error("email blocked", new Error(error), { template: message.templateKey });
    await recordDelivery(message, "unknown", { ok: false, error });
    return { ok: false, error };
  }

  const provider = getEmailProvider();
  let result: EmailResult;
  try {
    result = await provider.send(message);
  } catch (error) {
    // A provider should already swallow its own errors; this is the
    // guarantee that sendEmail never throws regardless.
    result = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  await recordDelivery(message, provider.name, result);
  return result;
}

/**
 * Writes to email_deliveries via the service role — the table is
 * admin-read-only with no insert policy, so a visitor can neither read
 * the send history nor forge an entry.
 *
 * Failures here are logged and swallowed: losing the audit row is bad,
 * but failing the customer's operation because the audit row failed is
 * worse.
 */
async function recordDelivery(
  message: EmailMessage,
  providerName: string,
  result: EmailResult
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("email_deliveries").insert({
      to_email: message.to,
      template_key: message.templateKey,
      subject: message.subject,
      provider: providerName,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error,
      is_marketing: message.kind === "marketing",
    });
    if (error) {
      logger.warn("email delivery record failed", { message: error.message });
    }
  } catch (error) {
    logger.warn("email delivery record threw", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

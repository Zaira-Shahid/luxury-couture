/**
 * Free-first email provider abstraction (Master Build Plan §3), same
 * shape as lib/payments/ — a real provider plus a working free fallback,
 * selected by whether credentials exist.
 *
 * THE MARKETING/TRANSACTIONAL SPLIT IS A TYPE, NOT A CONVENTION.
 *
 * A marketing message REQUIRES an unsubscribeUrl; a transactional one
 * cannot carry the field at all. UK PECR requires a working opt-out on
 * every marketing email, and Module 19 shipped campaign sending without
 * one — so the rule is expressed where it cannot be forgotten rather
 * than left to whoever writes the next campaign feature. The marketing
 * layout injects the link from this field, so "it has an unsubscribe
 * link" and "it type-checks" are the same statement.
 *
 * `send` never throws: a failed email must not break the operation that
 * triggered it (an order is still placed even if its confirmation
 * bounces). Failures come back as a result and are recorded.
 */

export type EmailAddress = { email: string; name?: string };

type BaseMessage = {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Required — some clients block HTML, and its absence hurts deliverability. */
  text: string;
  /** Which template produced this, recorded in email_deliveries. */
  templateKey: string;
};

export type EmailMessage =
  | (BaseMessage & { kind: "transactional"; unsubscribeUrl?: never })
  | (BaseMessage & { kind: "marketing"; unsubscribeUrl: string });

export type EmailResult =
  | { ok: true; providerId: string | null }
  | { ok: false; error: string };

export interface EmailProvider {
  /** Recorded against every delivery, so it is obvious whether a send was real. */
  readonly name: string;
  send(message: EmailMessage): Promise<EmailResult>;
}

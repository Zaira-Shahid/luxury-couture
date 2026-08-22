import { siteConfig } from "@/lib/config/site";

import { MockEmailProvider } from "./mock-provider";
import type { EmailProvider } from "./provider";
import { ResendEmailProvider } from "./resend-provider";

export type { EmailMessage, EmailProvider, EmailResult } from "./provider";

/**
 * Mirrors isStripeConfigured() (lib/payments/index.ts): a missing key
 * means "not configured yet", not an error. The whole application sends
 * email through the mock provider without one.
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

/**
 * Env-selected provider. Defaults to the mock, so a fresh checkout works
 * offline and costs nothing. Set RESEND_API_KEY *and* EMAIL_FROM to send
 * real mail — both are required, because Resend rejects a send from an
 * unverified domain and a half-configured provider that fails on every
 * message is worse than an honest mock.
 */
export function getEmailProvider(): EmailProvider {
  if (process.env.EMAIL_PROVIDER === "mock") return new MockEmailProvider();

  if (isEmailConfigured()) {
    return new ResendEmailProvider(process.env.RESEND_API_KEY!, process.env.EMAIL_FROM!);
  }
  return new MockEmailProvider();
}

/** Absolute URL for links inside emails — an email has no page origin to resolve against. */
export function emailUrl(path: string): string {
  const base = siteConfig.url.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

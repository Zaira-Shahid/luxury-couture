"use server";

import { redirect } from "next/navigation";

import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import { referralCodeSchema } from "@/lib/validations/marketing";

export type ActionResult = { error: string } | undefined;

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function signUp(formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const referralParsed = referralCodeSchema.safeParse({ code: formData.get("referralCode") });
  const referralCode = referralParsed.success ? referralParsed.data.code : "";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    logger.warn("sign up failed", { message: error.message });
    return { error: error.message };
  }

  // Best-effort: an invalid/mistyped/already-used code should never block
  // account creation, which has already succeeded by this point — just
  // log it rather than surfacing an error for something the account
  // itself doesn't depend on.
  if (referralCode && data.user) {
    const { error: referralError } = await supabase.rpc("redeem_referral_code", {
      p_code: referralCode,
      p_referred_customer_id: data.user.id,
    });
    if (referralError) {
      logger.warn("referral code redemption failed", { message: referralError.message, referralCode });
    }
  }

  // Best-effort welcome email. Deliberately not awaited-and-checked into
  // the result: an email problem must never make a successful sign-up
  // look like a failure. Note it arrives alongside Supabase's own
  // confirmation email — merging the two means customising Supabase's
  // auth template, which is configuration rather than code (docs/EMAIL.md).
  if (data.user?.email) {
    try {
      await sendEmail(await welcomeEmail(data.user.email, parsed.data.fullName));
    } catch (error) {
      logger.warn("welcome email failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  redirect("/register/check-email");
}

export async function signIn(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    logger.warn("sign in failed", { message: error.message });
    return { error: "Incorrect email or password." };
  }

  redirect("/account");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Whether a Supabase auth error is about SENDING the mail rather than
 * about the address it was sent to.
 *
 * The distinction is the whole point: a delivery failure says something
 * about this deployment's mail configuration and is safe (and useful) to
 * show, while anything about the identity behind the address must stay
 * hidden or the form becomes an account-enumeration oracle.
 */
function isMailDeliveryError(error: { code?: string; status?: number }): boolean {
  return (
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit" ||
    error.code === "email_provider_disabled" ||
    error.status === 429
  );
}

export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });

  if (error) {
    logger.warn("password reset request failed", { message: error.message, code: error.code });

    // DELIVERY failures are surfaced; IDENTITY failures are not.
    //
    // Swallowing everything was hiding a real problem: when Supabase's
    // built-in SMTP hits its rate limit it returns 429
    // over_email_send_rate_limit and sends nothing, but the customer was
    // still shown "check your email" — so the only visible symptom of a
    // blocked reset was an email that never arrived, and the natural
    // response (try again) burns the same limit and makes it worse.
    //
    // Telling them is safe. These codes are properties of the PROJECT's
    // mail sending, not of the address typed in: they are returned
    // identically whether or not an account exists, so they leak nothing
    // an attacker could enumerate with. "User not found" and friends stay
    // swallowed, which is what the enumeration guard was actually for.
    if (isMailDeliveryError(error)) {
      return {
        error:
          "We couldn't send the email just now — too many have been requested recently. Please wait an hour and try again.",
      };
    }
  }

  // Otherwise always report success, whether or not the address has an
  // account — the account-enumeration guard.
  redirect("/forgot-password/check-email");
}

export async function resetPassword(formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  // Requires the short-lived recovery session established by
  // /auth/callback after the user clicks the reset-password email link.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    logger.warn("password reset failed", { message: error.message });
    return { error: error.message };
  }

  redirect("/login");
}

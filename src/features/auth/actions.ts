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

export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });

  // Always report success, regardless of whether the email exists — an
  // account-enumeration guard, not an error-swallowing shortcut.
  if (error) logger.warn("password reset request failed", { message: error.message });
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

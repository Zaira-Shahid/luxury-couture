"use server";

import { getAiProvider } from "@/lib/ai";
import { applyGuardrails } from "@/lib/ai/guardrails";
import { getProfile, isStaffRole } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/settings/get-site-settings";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin-only AI drafting actions.
 *
 * These are DRAFT-AND-REVIEW, deliberately. Nothing here writes to
 * `products`, `orders`, `payments` or anything else — each action returns
 * text that lands in a form field the admin then edits and saves through
 * the existing, already-validated save action. That is the structural
 * form of the plan's "AI must never bypass admin controls": there is no
 * code path from a generation to a persisted business record.
 *
 * Every generation is logged to `ai_generations` (admin-only RLS), so
 * what was offered — and which guardrails fired — is auditable after the
 * fact.
 */

export type AiDraftResult =
  | { error: string }
  | {
      text: string;
      /** Non-empty when the guardrails redacted something; shown as a warning. */
      warnings: string[];
      provider: string;
    };

export type AiEmailDraftResult =
  | { error: string }
  | { subject: string; body: string; warnings: string[]; provider: string };

/**
 * Role check in the action itself, not only in the (admin) layout.
 * Server Actions are independently addressable POST endpoints — the
 * layout guard does not protect them, so each one re-checks. Same
 * discipline as the rest of the admin features.
 */
async function requireStaff(): Promise<{ id: string } | null> {
  const profile = await getProfile();
  if (!profile || !isStaffRole(profile.role)) return null;
  return { id: profile.id };
}

/**
 * Module 25: the admin drafting toggle is enforced HERE, not only by
 * hiding the button. These are independently addressable POST endpoints,
 * so a hidden button is a UI convenience and this is the actual switch.
 */
async function draftingEnabled(): Promise<boolean> {
  const settings = await getSiteSettings();
  return settings.ai.adminDraftingEnabled;
}

async function recordGeneration(params: {
  kind: string;
  provider: string;
  promptSummary: string;
  output: string;
  violations: { rule: string; match: string }[];
  actorId: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("ai_generations").insert({
    kind: params.kind,
    provider: params.provider,
    prompt_summary: params.promptSummary,
    output: params.output,
    guardrail_violations: params.violations,
    actor_id: params.actorId,
  });
  // Audit failure must not lose the admin's generated draft.
  if (error) logger.warn("ai_generations insert failed", { message: error.message });
}

function warningsFor(violations: { rule: string }[]): string[] {
  if (violations.length === 0) return [];
  const rules = [...new Set(violations.map((v) => v.rule))];
  return [
    `Removed content that isn't allowed in automated text (${rules.join(", ")}). Please check the draft before saving.`,
  ];
}

export async function generateProductDescription(formData: FormData): Promise<AiDraftResult> {
  const actor = await requireStaff();
  if (!actor) return { error: "Not authorised." };
  if (!(await draftingEnabled())) {
    return { error: "AI drafting is switched off in Settings." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter a product name first — the draft is written from it." };

  const categoryName = String(formData.get("categoryName") ?? "").trim() || null;
  const existingDescription = String(formData.get("existingDescription") ?? "").trim() || null;

  try {
    const provider = getAiProvider();
    const raw = await provider.writeProductDescription({
      name,
      categoryName,
      existingDescription,
      attributes: [],
    });

    // The providers guard their own output; re-running here is cheap and
    // means this action is safe even if a future provider forgets to.
    const guarded = applyGuardrails(raw);

    await recordGeneration({
      kind: "product_description",
      provider: provider.name,
      promptSummary: `Product: ${name}`,
      output: guarded.text,
      violations: guarded.violations,
      actorId: actor.id,
    });

    return { text: guarded.text, warnings: warningsFor(guarded.violations), provider: provider.name };
  } catch (error) {
    logger.error("product description generation failed", error, { name });
    return { error: "Could not generate a description. Please try again." };
  }
}

export async function generateEmailDraft(formData: FormData): Promise<AiEmailDraftResult> {
  const actor = await requireStaff();
  if (!actor) return { error: "Not authorised." };
  if (!(await draftingEnabled())) {
    return { error: "AI drafting is switched off in Settings." };
  }

  const orderNumber = String(formData.get("orderNumber") ?? "").trim();
  const intent = String(formData.get("intent") ?? "").trim();
  if (!orderNumber) return { error: "Missing order reference." };
  if (!intent) return { error: "Describe what you want to say, and we'll draft it." };

  const orderStatus = String(formData.get("orderStatus") ?? "").trim() || "unknown";
  const customerName = String(formData.get("customerName") ?? "").trim() || null;

  try {
    const provider = getAiProvider();
    const draft = await provider.draftEmail({ orderNumber, orderStatus, customerName, intent });

    const guardedSubject = applyGuardrails(draft.subject);
    const guardedBody = applyGuardrails(draft.body);
    const violations = [...guardedSubject.violations, ...guardedBody.violations];

    await recordGeneration({
      kind: "email_draft",
      provider: provider.name,
      promptSummary: `Order: ${orderNumber}`,
      output: `${guardedSubject.text}\n\n${guardedBody.text}`,
      violations,
      actorId: actor.id,
    });

    return {
      subject: guardedSubject.text,
      body: guardedBody.text,
      warnings: warningsFor(violations),
      provider: provider.name,
    };
  } catch (error) {
    logger.error("email draft generation failed", error, { orderNumber });
    return { error: "Could not draft that email. Please try again." };
  }
}

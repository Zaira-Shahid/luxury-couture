"use server";

import { revalidatePath } from "next/cache";

import { getProfile, isStaffRole } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { entriesForSection, type SettingSection } from "@/lib/settings/registry";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true };

/**
 * Saves one settings section.
 *
 * Only keys belonging to the named section are written, and each is
 * looked up in the registry first — so a crafted form post cannot set an
 * arbitrary `site_settings` key. That matters because the table also
 * holds operational switches (`seo.indexing_enabled`) and because keys
 * outside the registry are ignored on read, which would make a bad write
 * silently invisible rather than obviously wrong.
 *
 * Authorization is RLS (`site_settings` is admin-only for all operations,
 * 0012) plus the role check here — Server Actions are independently
 * addressable POST endpoints, so the (admin) layout guard does not cover
 * them.
 */
export async function updateSettingsSection(
  section: SettingSection,
  formData: FormData
): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile || !isStaffRole(profile.role)) return { error: "Not authorised." };

  const entries = entriesForSection(section);
  if (entries.length === 0) return { error: "Unknown settings section." };

  const supabase = await createClient();
  const toUpsert: { key: string; value: string | boolean | number }[] = [];
  const toDelete: string[] = [];

  for (const entry of entries) {
    if (entry.type === "boolean") {
      // An unchecked checkbox submits nothing at all, which is the only
      // way to distinguish false from absent — so booleans are always
      // written, never deleted.
      toUpsert.push({ key: entry.key, value: formData.get(entry.key) === "on" });
      continue;
    }

    const raw = formData.get(entry.key);
    const value = typeof raw === "string" ? raw.trim() : "";

    if (value === "") {
      // Empty means "use the default", so the row is removed rather than
      // stored as "" — otherwise getSiteSettings() would return an empty
      // string where call sites expect null and fall back.
      toDelete.push(entry.key);
      continue;
    }

    if (entry.type === "select") {
      if (!entry.options?.some((option) => option.value === value)) {
        return { error: `"${value}" is not a valid choice for ${entry.label}.` };
      }
    }

    if (entry.type === "number") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        return { error: `${entry.label} must be a number.` };
      }
      toUpsert.push({ key: entry.key, value: parsed });
      continue;
    }

    toUpsert.push({ key: entry.key, value });
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase.from("site_settings").upsert(toUpsert, { onConflict: "key" });
    if (error) {
      logger.error("settings save failed", error, { section });
      return { error: "Could not save these settings." };
    }
  }

  if (toDelete.length > 0) {
    const { error } = await supabase.from("site_settings").delete().in("key", toDelete);
    if (error) {
      logger.error("settings clear failed", error, { section });
      return { error: "Could not clear the empty fields." };
    }
  }

  // Settings reach every route — brand name in metadata, theme variables
  // on <html>, currency in prices — so the whole layout is revalidated.
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return { success: true };
}

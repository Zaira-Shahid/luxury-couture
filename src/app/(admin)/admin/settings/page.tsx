import type { Metadata } from "next";
import Link from "next/link";

import { updateSettingsSection } from "@/features/admin-settings/actions";
import {
  ENV_CREDENTIALS,
  SECTION_LABELS,
  SECTION_ORDER,
  entriesForSection,
  type SettingSection,
} from "@/lib/settings/registry";
import { getSiteSettings } from "@/lib/settings/get-site-settings";
import type { SiteSettings } from "@/lib/settings/types";
import { cn } from "@/lib/utils";

import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

function resolveSection(raw: string | undefined): SettingSection {
  return SECTION_ORDER.includes(raw as SettingSection) ? (raw as SettingSection) : "general";
}

/** Reads a registry path out of the typed settings object for the form's initial value. */
function valueAt(settings: SiteSettings, path: [string, string]): string | boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (settings as any)[path[0]]?.[path[1]];
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Integration status. Reads only whether the variable is SET — the value
 * is never read into a variable, never passed to a component, and never
 * rendered. Live credentials do not belong in a database row every admin
 * can read, so they stay in the environment and this screen reports only
 * their presence.
 */
function credentialStatus() {
  return ENV_CREDENTIALS.map((credential) => ({
    ...credential,
    configured: Boolean(process.env[credential.env]),
  }));
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section: rawSection } = await searchParams;
  const section = resolveSection(rawSection);
  const settings = await getSiteSettings();

  const entries = entriesForSection(section);
  const values: Record<string, string | boolean> = {};
  for (const entry of entries) values[entry.key] = valueAt(settings, entry.path);

  const credentials = credentialStatus();

  return (
    <div className="container flex flex-col gap-8 py-10">
      <div>
        <h1 className="font-heading text-2xl">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Business configuration for the whole site. Changes take effect immediately.
        </p>
      </div>

      <nav aria-label="Settings sections" className="flex flex-wrap gap-1 text-sm">
        {SECTION_ORDER.map((option) => (
          <Link
            key={option}
            href={`/admin/settings?section=${option}`}
            className={cn(
              "rounded-lg border px-3 py-1.5 transition-colors",
              section === option
                ? "border-foreground/20 bg-muted font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {SECTION_LABELS[option]}
          </Link>
        ))}
      </nav>

      {section === "seo" && !settings.seo.indexingEnabled ? (
        <div className="max-w-2xl rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-foreground">This site is hidden from search engines.</p>
          <p className="mt-1 text-muted-foreground">
            robots.txt blocks all crawlers and every page sends <code>noindex</code>. Turn on
            indexing below when you are ready to launch.
          </p>
        </div>
      ) : null}

      {section === "analytics" ? (
        <p className="max-w-2xl text-sm text-muted-foreground">
          These are public identifiers, not secrets. A pixel only loads for visitors who accepted
          marketing cookies, and leaving a field blank means that vendor never loads at all.
        </p>
      ) : null}

      <SettingsForm
        key={section}
        section={section}
        entries={entries}
        values={values}
        action={updateSettingsSection}
      />

      {section === "seo" ? (
        <p className="text-sm text-muted-foreground">
          Per-page SEO overrides for individual products, collections and pages live on the{" "}
          <Link href="/admin/seo" className="underline hover:text-foreground">
            SEO screen
          </Link>
          .
        </p>
      ) : null}

      <section className="max-w-2xl border-t border-border pt-8">
        <h2 className="font-heading text-xl">Integrations</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          API keys are stored as environment variables, never in the database — so they cannot be
          read from this screen or by anyone with admin access. Set them where you deploy.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Integration</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Effect if not set</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((credential) => (
                <tr key={credential.env} className="border-t border-border">
                  <td className="px-4 py-2">
                    <span className="font-medium text-foreground">{credential.label}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {credential.env}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {credential.configured ? (
                      <span className="text-foreground">Configured</span>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{credential.help}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

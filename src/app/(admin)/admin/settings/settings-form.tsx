"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/features/admin-settings/actions";
import type { SettingEntry, SettingSection } from "@/lib/settings/registry";

/**
 * Renders a settings section from the registry rather than from
 * hand-written JSX. Adding a setting is one registry entry — there is no
 * form file to remember to update, which is the drift this replaced.
 *
 * Follows the project's standard admin form shape: a client wrapper
 * calling a server action inside useTransition, since React 18 has no
 * useActionState (see docs/ARCHITECTURE.md).
 */
export function SettingsForm({
  section,
  entries,
  values,
  action,
}: {
  section: SettingSection;
  entries: SettingEntry[];
  /** Current value per key, already stringified by the server. */
  values: Record<string, string | boolean>;
  action: (section: SettingSection, formData: FormData) => Promise<ActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(section, formData);
      if ("error" in result) setError(result.error);
      else toast.success("Settings saved.");
    });
  }

  return (
    <form action={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      {entries.map((entry) => {
        const value = values[entry.key];

        if (entry.type === "boolean") {
          return (
            <div key={entry.key} className="rounded-lg border border-border p-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name={entry.key}
                  defaultChecked={value === true}
                  className="mt-0.5 size-4"
                />
                <span>
                  <span className="font-medium text-foreground">{entry.label}</span>
                  {entry.help ? (
                    <span className="mt-1 block text-muted-foreground">{entry.help}</span>
                  ) : null}
                </span>
              </label>
            </div>
          );
        }

        return (
          <div key={entry.key} className="flex flex-col gap-1.5">
            <Label htmlFor={entry.key}>{entry.label}</Label>

            {entry.type === "textarea" ? (
              <Textarea
                id={entry.key}
                name={entry.key}
                rows={3}
                defaultValue={typeof value === "string" ? value : ""}
                placeholder={entry.placeholder}
              />
            ) : entry.type === "select" ? (
              <select
                id={entry.key}
                name={entry.key}
                defaultValue={typeof value === "string" ? value : ""}
                className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {entry.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={entry.key}
                name={entry.key}
                type={entry.type === "number" ? "number" : "text"}
                defaultValue={typeof value === "string" ? value : ""}
                placeholder={entry.placeholder}
              />
            )}

            {entry.help ? (
              <p className="text-xs text-muted-foreground">{entry.help}</p>
            ) : null}
          </div>
        );
      })}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

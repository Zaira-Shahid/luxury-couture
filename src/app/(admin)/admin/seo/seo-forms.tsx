"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/features/admin-seo/actions";
import type { SiteSettings } from "@/lib/settings/types";
import type { SeoEntityType } from "@/lib/seo/get-seo-metadata";
import type { SeoMetadata } from "@/types/database";

export function SeoDefaultsForm({
  settings,
  action,
}: {
  settings: SiteSettings;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result) setError(result.error);
      else toast.success("SEO settings saved.");
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="defaultTitle">Default site title</Label>
        <Input id="defaultTitle" name="defaultTitle" defaultValue={settings.seo.defaultTitle ?? ""} />
        <p className="text-xs text-muted-foreground">
          Used as the brand name in the title template, Open Graph and structured data.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="defaultDescription">Default meta description</Label>
        <Textarea
          id="defaultDescription"
          name="defaultDescription"
          rows={3}
          defaultValue={settings.seo.defaultDescription ?? ""}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="defaultOgImageUrl">Default share image URL</Label>
          <Input
            id="defaultOgImageUrl"
            name="defaultOgImageUrl"
            defaultValue={settings.seo.defaultOgImageUrl ?? ""}
          />
          <p className="text-xs text-muted-foreground">Recommended 1200×630.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="twitterHandle">Twitter/X handle</Label>
          <Input
            id="twitterHandle"
            name="twitterHandle"
            placeholder="@yourbrand"
            defaultValue={settings.seo.twitterHandle ?? ""}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="googleSiteVerification">Google Search Console verification token</Label>
        <Input
          id="googleSiteVerification"
          name="googleSiteVerification"
          defaultValue={settings.seo.googleSiteVerification ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          The <code>content</code> value from Google&apos;s HTML tag method — not the whole tag. See
          docs/SEO.md.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="indexingEnabled"
            defaultChecked={settings.seo.indexingEnabled}
            className="mt-0.5 size-4"
          />
          <span>
            <span className="font-medium text-foreground">Allow search engines to index this site</span>
            <span className="mt-1 block text-muted-foreground">
              Off by default so a pre-launch site is never crawled. While off, robots.txt blocks
              everything and every page sends <code>noindex</code>. Turn this on at launch.
            </span>
          </span>
        </label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Save SEO settings"}
      </Button>
    </form>
  );
}

export type OverrideTarget = {
  entityType: SeoEntityType;
  entityId: string;
  label: string;
  path: string;
  existing: SeoMetadata | null;
};

export function SeoOverrideForm({
  target,
  action,
}: {
  target: OverrideTarget;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result) setError(result.error);
      else toast.success("Override saved.");
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 border-t border-border py-4">
      {/* entityType/entityId are re-validated server-side against a fixed
          enum and a uuid check — the hidden fields are convenience, not
          trust. */}
      <input type="hidden" name="entityType" value={target.entityType} />
      <input type="hidden" name="entityId" value={target.entityId} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{target.label}</p>
        <p className="text-xs text-muted-foreground">{target.path}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          name="metaTitle"
          placeholder="Meta title override"
          defaultValue={target.existing?.meta_title ?? ""}
        />
        <Input
          name="ogImageUrl"
          placeholder="Share image URL override"
          defaultValue={target.existing?.og_image_url ?? ""}
        />
      </div>
      <Textarea
        name="metaDescription"
        rows={2}
        placeholder="Meta description override"
        defaultValue={target.existing?.meta_description ?? ""}
      />
      <Input
        name="canonicalUrl"
        placeholder="Canonical URL override (leave blank to use the page's own URL)"
        defaultValue={target.existing?.canonical_url ?? ""}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="sm" variant="secondary" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Save override"}
      </Button>
    </form>
  );
}

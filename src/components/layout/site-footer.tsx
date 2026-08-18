import { siteConfig } from "@/lib/config/site";
import { getSiteSettings } from "@/lib/settings/get-site-settings";

const SOCIAL_LABELS = {
  instagram: "Instagram",
  facebook: "Facebook",
  pinterest: "Pinterest",
  whatsapp: "WhatsApp",
} as const;

export async function SiteFooter() {
  const settings = await getSiteSettings();
  const socialEntries = Object.entries(settings.store.socialLinks).filter(([, url]) => url);
  const hasContact =
    settings.store.contactEmail || settings.store.contactPhone || settings.store.contactAddress;

  return (
    <footer className="border-t border-border bg-background">
      <div className="container flex flex-col gap-6 py-10 text-sm text-muted-foreground">
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
          {hasContact ? (
            <div className="flex flex-col gap-1">
              {settings.store.contactEmail ? <p>{settings.store.contactEmail}</p> : null}
              {settings.store.contactPhone ? <p>{settings.store.contactPhone}</p> : null}
              {settings.store.contactAddress ? <p>{settings.store.contactAddress}</p> : null}
            </div>
          ) : null}
          {socialEntries.length ? (
            <div className="flex gap-4">
              {socialEntries.map(([key, url]) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="transition-colors hover:text-foreground"
                >
                  {SOCIAL_LABELS[key as keyof typeof SOCIAL_LABELS] ?? key}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <p className="text-center">
          {settings.store.footerText ?? (
            <>
              &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
            </>
          )}
        </p>
      </div>
    </footer>
  );
}

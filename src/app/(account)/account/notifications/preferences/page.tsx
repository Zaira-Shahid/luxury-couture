import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  NOTIFICATION_CATEGORIES,
} from "@/lib/notifications/categories";
import { getNotificationPreferences } from "@/lib/notifications/get-notifications";
import { getProfile } from "@/lib/auth/session";

import { PreferencesForm } from "./preferences-form";

export const metadata: Metadata = { title: "Email preferences" };

export default async function NotificationPreferencesPage() {
  const [preferences, profile] = await Promise.all([getNotificationPreferences(), getProfile()]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1.5">
        <CardTitle>Email preferences</CardTitle>
        <CardDescription>
          Choose which updates reach your inbox. Everything still appears in your{" "}
          <Link href="/account/notifications" className="underline underline-offset-4">
            notifications
          </Link>{" "}
          either way — that feed is your record of what happened, so it cannot be switched off.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PreferencesForm
          categories={NOTIFICATION_CATEGORIES.map((category) => ({
            value: category,
            label: CATEGORY_LABELS[category],
            description: CATEGORY_DESCRIPTIONS[category],
            enabled: preferences[category],
          }))}
          marketingOptOut={profile?.marketing_opt_out ?? false}
        />
      </CardContent>
    </Card>
  );
}

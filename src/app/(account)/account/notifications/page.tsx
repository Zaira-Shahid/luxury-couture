import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/types/database";

import { NotificationItem } from "./notification-item";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = user
    ? await supabase
        .from("notifications")
        .select("*")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  const notifications = (data ?? []) as Notification[];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Updates about your orders and account.</CardDescription>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                id={n.id}
                title={n.title}
                body={n.body}
                createdAt={n.created_at}
                isRead={!!n.read_at}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

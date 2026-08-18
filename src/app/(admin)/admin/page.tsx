import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { getProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHomePage() {
  const profile = await getProfile();

  return (
    <div className="container flex flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardDescription>
            Signed in as {profile?.full_name ?? "staff"} ({profile?.role}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The full admin dashboard is built in a later module.
          </p>
        </CardContent>
      </Card>
      <div>
        <SignOutButton />
      </div>
    </div>
  );
}

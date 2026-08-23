import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthUser, getProfile } from "@/lib/auth/session";

import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const [user, profile] = await Promise.all([getAuthUser(), getProfile()]);
  if (!profile || !user) return null; // layout already redirects when signed out

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">Profile</CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileForm key={`${profile.id}-${profile.updated_at}`} profile={profile} />
      </CardContent>
    </Card>
  );
}

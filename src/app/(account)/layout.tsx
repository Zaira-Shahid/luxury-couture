import { redirect } from "next/navigation";

import { AccountNav } from "@/components/layout/account-nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { getProfile } from "@/lib/auth/session";

export default async function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Middleware already gates /account, but Server Components render
  // independently of it — check again here rather than assume.
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account");

  return (
    <div className="container flex flex-col gap-8 py-10 md:flex-row">
      <aside className="flex flex-col gap-4 md:w-56 md:shrink-0">
        <AccountNav />
        <SignOutButton />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

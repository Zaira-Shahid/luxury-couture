export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Same gap as (account): no landmark, so the skip link had nothing to
    // target on the sign-in and password-reset pages.
    <main id="main-content" className="flex min-h-screen items-center justify-center">
      {children}
    </main>
  );
}

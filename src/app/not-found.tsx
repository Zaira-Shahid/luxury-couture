import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm tracking-[0.3em] text-muted-foreground uppercase">404</p>
      <h1 className="font-heading text-4xl">Page not found</h1>
      <p className="max-w-md text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link href="/" className={buttonVariants({ variant: "default" })}>
        Return home
      </Link>
    </div>
  );
}

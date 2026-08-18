import { Suspense } from "react";

import { CallbackClient } from "./callback-client";

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <CallbackClient />
      </Suspense>
    </div>
  );
}

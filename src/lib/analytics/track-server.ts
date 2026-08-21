// Server-only: `next/headers` throws if this is ever pulled into a Client
// Component, which is the enforcement mechanism here. The `server-only`
// package isn't a dependency of this project and isn't used anywhere else
// (lib/supabase/admin.ts documents its own server-only nature the same
// way), so adding it just for this file isn't warranted.
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

import {
  ANALYTICS_SESSION_COOKIE,
  CONSENT_COOKIE,
  hasAnalyticsConsent,
  parseConsent,
} from "./consent";
import { isTransactionEvent, type AnalyticsEventName, type AnalyticsProperties } from "./events";
import { getAnalyticsProvider } from "./index";

/**
 * Records an event from a Server Action.
 *
 * The consent gate lives here rather than at each call site, so no future
 * action can forget it: an instrumented action just calls trackServer()
 * and this decides whether anything is actually written.
 *
 * Two outcomes when analytics consent is absent:
 *  - a behavioural event (add_to_cart, wishlist_action, …) is dropped
 *    entirely;
 *  - a transaction event (purchase, payment_completed) is still recorded,
 *    but with session_id = null. Those restate facts already in
 *    orders/payments, involve no device storage, and dropping them would
 *    leave the funnel's last step permanently empty. Because the funnel
 *    counts DISTINCT session_id per step, a null-session purchase can
 *    never inflate a conversion rate.
 *
 * Never throws — see AnalyticsProvider.
 */
export async function trackServer(
  name: AnalyticsEventName,
  properties: AnalyticsProperties = {},
  options: { profileId?: string | null } = {}
): Promise<void> {
  try {
    const cookieStore = await cookies();
    const consent = parseConsent(cookieStore.get(CONSENT_COOKIE)?.value);
    const consented = hasAnalyticsConsent(consent);

    if (!consented && !isTransactionEvent(name)) return;

    const sessionId = consented
      ? (cookieStore.get(ANALYTICS_SESSION_COOKIE)?.value ?? null)
      : null;

    const supabase = await createClient();

    let profileId = options.profileId ?? null;
    if (profileId === null) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      profileId = user?.id ?? null;
    }

    await getAnalyticsProvider(supabase).track({ name, properties, profileId, sessionId });
  } catch {
    // Deliberately silent: analytics must never surface an error into the
    // Server Action's own result, which the customer sees.
  }
}

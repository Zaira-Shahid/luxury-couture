import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  unsubscribeFromMarketing,
  unsubscribeFromNewsletter,
} from "@/features/marketing/actions";

export const metadata: Metadata = { title: "Unsubscribe" };

/** A token is a uuid in both schemes; anything else can't match either. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && UUID_PATTERN.test(token);

  // Two independent opt-out schemes now exist: newsletter subscribers
  // (0043) and customer accounts (0051, added in Module 24 because
  // customer-segment campaigns had no opt-out at all). Both are tried
  // blind — one matches, the other is a no-op, and neither reports which.
  // Confirming which scheme a token belongs to would leak whether an
  // account or a subscription exists for that person.
  //
  // The same reasoning drives the wording below: an unknown token gets
  // the same response as a valid one, so this page cannot be used to
  // probe which addresses are registered. The copy is phrased
  // conditionally ("if that address was subscribed") so it stays
  // non-disclosing without asserting something that may not be true.
  let succeeded = false;
  if (valid) {
    const [newsletter, marketing] = await Promise.all([
      unsubscribeFromNewsletter(token),
      unsubscribeFromMarketing(token),
    ]);
    succeeded = !("error" in newsletter) || !("error" in marketing);
  }

  return (
    <div className="container flex max-w-md flex-col items-center py-24 text-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Unsubscribe</CardTitle>
        </CardHeader>
        <CardContent>
          {!valid || !succeeded ? (
            <p className="text-sm text-muted-foreground">
              That link doesn&apos;t look right. If you&apos;d like to be removed from our list,
              please contact us.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              If that address was subscribed, it has now been removed from our marketing emails
              and won&apos;t receive further promotional messages. You&apos;ll still get essential
              updates about any order you place.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

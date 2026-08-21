import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { unsubscribeFromNewsletter } from "@/features/marketing/actions";

export const metadata: Metadata = { title: "Unsubscribe" };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await unsubscribeFromNewsletter(token) : { error: "Missing unsubscribe link." };

  return (
    <div className="container flex max-w-md flex-col items-center py-24 text-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Unsubscribe</CardTitle>
        </CardHeader>
        <CardContent>
          {"error" in result ? (
            <p className="text-sm text-muted-foreground">
              That link doesn&apos;t look right. If you&apos;d like to be removed from our list, please contact us.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              You&apos;ve been unsubscribed from our newsletter. You won&apos;t receive further emails from us.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

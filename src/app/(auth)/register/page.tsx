import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle as="h1" className="text-2xl">Create an account</CardTitle>
        <CardDescription>Save your measurements, orders, and wishlist.</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm referralCode={ref ?? ""} />
      </CardContent>
    </Card>
  );
}

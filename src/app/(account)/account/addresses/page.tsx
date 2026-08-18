import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Address } from "@/types/database";

import { AddressForm } from "./address-form";
import { DeleteAddressButton } from "./delete-address-button";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const supabase = await createClient();
  // RLS scopes this to the signed-in customer's own rows.
  const { data: addresses } = await supabase
    .from("addresses")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Saved addresses</CardTitle>
        </CardHeader>
        <CardContent>
          {addresses?.length ? (
            <ul className="flex flex-col gap-3">
              {(addresses as Address[]).map((address) => (
                <li
                  key={address.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border p-3"
                >
                  <div className="text-sm">
                    {address.label ? (
                      <p className="font-medium">{address.label}</p>
                    ) : null}
                    <p>{address.recipient_name}</p>
                    <p className="text-muted-foreground">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}, {address.city}
                      {address.region ? `, ${address.region}` : ""} {address.postal_code},{" "}
                      {address.country}
                    </p>
                    {address.is_default ? (
                      <p className="mt-1 text-xs text-primary">Default</p>
                    ) : null}
                  </div>
                  <DeleteAddressButton addressId={address.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No addresses saved yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add a new address</CardTitle>
        </CardHeader>
        <CardContent>
          <AddressForm />
        </CardContent>
      </Card>
    </div>
  );
}

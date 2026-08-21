import type { Metadata } from "next";
import Link from "next/link";

import { getAdminCustomers } from "@/lib/admin/get-customers";

export const metadata: Metadata = { title: "Customers" };

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

export default async function AdminCustomersPage() {
  const customers = await getAdminCustomers();

  return (
    <div className="container py-10">
      <h1 className="mb-6 font-heading text-2xl">Customers</h1>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Orders</th>
              <th className="px-4 py-2">Lifetime spend</th>
              <th className="px-4 py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No customers yet.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/admin/customers/${customer.id}`} className="hover:underline">
                      {customer.full_name ?? "Unnamed customer"}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{customer.orderCount}</td>
                  <td className="px-4 py-2">{formatPrice(customer.lifetimeSpend)}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(customer.created_at).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

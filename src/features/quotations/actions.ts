"use server";

import { redirect } from "next/navigation";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true };

/**
 * quotations is admin-write-only by RLS (0006) — quoted_price, deposit,
 * etc. are all admin-controlled and there's no customer-writable
 * "acceptance" column modeled separately. Accepting is therefore a
 * legitimate, narrow use of the service-role client: this action itself
 * enforces "only the true owner, on a still-open quotation, can accept
 * it" via a regular RLS-respecting read *before* touching the admin
 * client for the actual write — the elevation is scoped to exactly this
 * one enforced transition, not a general bypass.
 */
export async function acceptQuotation(quotationId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const addressId = formData.get("addressId");
  if (typeof addressId !== "string" || !addressId) {
    return { error: "Choose a shipping address." };
  }

  const { data: quotation } = await supabase
    .from("quotations")
    .select("id, enquiry_id, customer_id, quoted_price, status")
    .eq("id", quotationId)
    .single();
  if (!quotation || quotation.customer_id !== user.id) {
    return { error: "Quotation not found." };
  }
  if (quotation.status !== "sent") {
    return { error: "This quotation is no longer open for approval." };
  }

  const { data: address } = await supabase
    .from("addresses")
    .select("id")
    .eq("id", addressId)
    .eq("customer_id", user.id)
    .single();
  if (!address) return { error: "Choose a valid shipping address." };

  const { data: enquiry } = await supabase
    .from("enquiries")
    .select("builder_configuration_id, message")
    .eq("id", quotation.enquiry_id)
    .single();

  const measurementProfileId = formData.get("measurementProfileId");
  const measurementId = typeof measurementProfileId === "string" && measurementProfileId ? measurementProfileId : null;
  if (enquiry?.builder_configuration_id && !measurementId) {
    return { error: "Choose a measurement profile for your custom design." };
  }
  if (measurementId) {
    const { data: profile } = await supabase
      .from("measurement_profiles")
      .select("id")
      .eq("id", measurementId)
      .eq("customer_id", user.id)
      .single();
    if (!profile) return { error: "Choose a valid measurement profile." };
  }

  const admin = createAdminClient();

  const { error: acceptErr } = await admin
    .from("quotations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", quotationId)
    .eq("status", "sent"); // guards against a double-accept race

  if (acceptErr) {
    logger.error("quotation accept failed", acceptErr, { quotationId });
    return { error: "Could not accept this quotation. Please try again." };
  }

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      customer_id: user.id,
      quotation_id: quotationId,
      measurement_profile_id: measurementId,
      shipping_address_id: addressId,
      status: "pending",
      subtotal: quotation.quoted_price,
      total_amount: quotation.quoted_price,
    })
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    logger.error("order creation from quotation failed", orderErr, { quotationId });
    return { error: "Your quotation was accepted, but the order could not be created — please contact us." };
  }

  await admin.from("order_items").insert({
    order_id: order.id,
    builder_configuration_id: enquiry?.builder_configuration_id ?? null,
    description_snapshot: enquiry?.message ? `Custom order — ${enquiry.message.slice(0, 200)}` : "Custom order",
    quantity: 1,
    unit_price: quotation.quoted_price,
    line_total: quotation.quoted_price,
  });

  await admin.from("payments").insert({
    order_id: order.id,
    type: "full",
    amount: quotation.quoted_price,
    status: "pending",
    provider: "manual",
  });

  redirect(`/checkout/confirmed/${order.order_number}`);
}

export async function rejectQuotation(quotationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: quotation } = await supabase
    .from("quotations")
    .select("customer_id, status")
    .eq("id", quotationId)
    .single();
  if (!quotation || quotation.customer_id !== user.id) return { error: "Quotation not found." };
  if (quotation.status !== "sent") return { error: "This quotation is no longer open." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("quotations")
    .update({ status: "rejected" })
    .eq("id", quotationId)
    .eq("status", "sent");

  if (error) {
    logger.error("quotation reject failed", error, { quotationId });
    return { error: "Could not update this quotation. Please try again." };
  }

  return { success: true };
}

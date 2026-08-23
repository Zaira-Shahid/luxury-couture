import { type NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import {
  consultationReminderTemplate,
  paymentReminderTemplate,
} from "@/lib/notifications/templates";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";

/** Don't chase a balance the moment an order is placed. */
const PAYMENT_REMINDER_AFTER_DAYS = 7;
/** And don't chase it forever — repeat at most this often. */
const PAYMENT_REMINDER_EVERY_DAYS = 14;
/** Consultation reminders go out the day before. */
const APPOINTMENT_REMINDER_WINDOW_HOURS = 48;

/**
 * Vercel Cron-triggered (vercel.json, daily). Sends the two reminders
 * Module 27 asks for and nothing else: outstanding balances, and
 * consultations happening tomorrow.
 *
 * Authorization matches /api/cron/abandon-carts exactly — Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET`. If CRON_SECRET is unset the
 * check is skipped, matching this project's "unset = not configured yet"
 * tolerance, but it MUST be set before any real deploy: this endpoint
 * emails customers.
 *
 * DUPLICATE SUPPRESSION IS THE HARD PART, and it is done by inserting
 * into notification_reminders BEFORE sending. The primary key
 * (entity_type, entity_id, kind) means a second attempt conflicts and
 * this run skips it. Two overlapping invocations cannot both send,
 * because the loser loses at the database rather than at a timestamp
 * comparison it read a moment ago.
 *
 * The consequence, stated plainly: if the insert succeeds and the send
 * then fails, that reminder is NOT retried. That is the deliberate
 * trade — a customer missing one reminder is a smaller harm than a
 * customer receiving the same chase-up email repeatedly, and the failure
 * is logged either way.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const now = Date.now();

  /**
   * Claims a reminder. Returns false when one has already been sent,
   * which is what makes this safe to run twice.
   */
  async function claim(entityType: string, entityId: string, kind: string) {
    const { error } = await admin
      .from("notification_reminders")
      .insert({ entity_type: entityType, entity_id: entityId, kind });
    if (!error) return true;
    // 23505 = unique_violation: already claimed, by an earlier run or a
    // concurrent one. Anything else is a real failure worth logging.
    if (error.code !== "23505") {
      logger.warn("reminder claim failed", { entityType, entityId, kind, message: error.message });
    }
    return false;
  }

  // -------------------------------------------------------------------
  // Outstanding balances
  const paymentCutoff = new Date(now - PAYMENT_REMINDER_AFTER_DAYS * 86_400_000).toISOString();

  const { data: owing, error: ordersError } = await admin
    .from("orders")
    .select("id, order_number, customer_id, balance_due_amount, currency, created_at, status")
    .gt("balance_due_amount", 0)
    .lt("created_at", paymentCutoff)
    // Excludes 'pending' (not yet confirmed, so not yet a debt) and
    // 'cancelled' (no longer one). 'delivered' stays IN: a delivered
    // order with money still outstanding is exactly the case worth
    // chasing.
    .in("status", ["confirmed", "in_production", "ready_to_ship", "shipped", "delivered"]);

  if (ordersError) {
    logger.error("reminder cron: order query failed", ordersError);
  }

  let paymentsSent = 0;
  for (const order of owing ?? []) {
    if (!order.customer_id) continue;

    // The kind carries the period, so a balance can be chased again a
    // fortnight later without the ledger blocking it forever.
    const period = Math.floor(
      (now - new Date(order.created_at).getTime()) /
        (PAYMENT_REMINDER_EVERY_DAYS * 86_400_000)
    );
    if (!(await claim("order", order.id, `payment_reminder_${period}`))) continue;

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (!profile) continue;

    const { data: authUser } = await admin.auth.admin.getUserById(order.customer_id);

    await notify(admin, {
      profileId: order.customer_id,
      email: authUser?.user?.email ?? null,
      entityId: order.id,
      ...paymentReminderTemplate(
        order.order_number,
        Number(order.balance_due_amount),
        order.currency ?? "GBP"
      ),
    });
    paymentsSent += 1;
  }

  // -------------------------------------------------------------------
  // Consultations happening tomorrow
  const windowEnd = new Date(now + APPOINTMENT_REMINDER_WINDOW_HOURS * 3_600_000).toISOString();

  const { data: upcoming, error: appointmentsError } = await admin
    .from("appointments")
    .select("id, customer_id, type, scheduled_at, status")
    .eq("status", "confirmed")
    .gt("scheduled_at", new Date(now).toISOString())
    .lt("scheduled_at", windowEnd);

  if (appointmentsError) {
    logger.error("reminder cron: appointment query failed", appointmentsError);
  }

  let appointmentsSent = 0;
  for (const appointment of upcoming ?? []) {
    // A guest booking has no account and no in-app inbox. Appointments
    // carry no contact column of their own, so there is nothing to send
    // to — skipping is the honest behaviour rather than silently
    // pretending a reminder went out.
    if (!appointment.customer_id) continue;

    // Only ever once per appointment: unlike a balance, there is no
    // second occasion to remind someone about the same booking.
    if (!(await claim("appointment", appointment.id, "consultation_reminder"))) continue;

    const { data: authUser } = await admin.auth.admin.getUserById(appointment.customer_id);

    await notify(admin, {
      profileId: appointment.customer_id,
      email: authUser?.user?.email ?? null,
      ...consultationReminderTemplate(appointment.scheduled_at, appointment.type),
    });
    appointmentsSent += 1;
  }

  logger.info("reminder cron complete", { paymentsSent, appointmentsSent });
  return NextResponse.json({ paymentsSent, appointmentsSent });
}

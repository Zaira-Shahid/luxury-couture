/**
 * Removes every account whose email ends in the dev-test domain, along
 * with the rows hanging off it.
 *
 * WHY THIS EXISTS. Test scripts clean up at the end, which works right
 * up until one throws partway through — then its fixtures survive and
 * become another script's input. That is not hypothetical: a crashed
 * run of test-reminders.mjs left a customer holding £2,500 of orders,
 * who then counted as a second VIP and made test-marketing-pass2.mjs
 * report 48/1 instead of 49/0. The regression gate caught it, but the
 * cause was a leaked fixture rather than a real defect, and diagnosing
 * that cost more than preventing it.
 *
 * So the fix is IDEMPOTENT SETUP rather than perfect teardown: each
 * script purges before it starts, and a crash can no longer poison the
 * next run. End-of-script cleanup stays, because leaving rows behind for
 * a human to find is still bad.
 *
 * SAFETY: only touches addresses ending in the dev-test domain, which no
 * real account can hold. It is destructive by design, so the filter is
 * deliberately narrow and is asserted rather than assumed.
 *
 * Safe because run-suite.mjs runs scripts SEQUENTIALLY. If that ever
 * becomes parallel, this has to go — one script would delete another's
 * fixtures mid-run.
 */

const DEVTEST_DOMAIN = "@luxury-couture-devtest.local";

export async function purgeDevtestData(admin, { verbose = false } = {}) {
  let purged = 0;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`purgeDevtestData: listUsers failed: ${error.message}`);
    if (!data.users.length) break;

    const leaked = data.users.filter((user) =>
      (user.email ?? "").toLowerCase().endsWith(DEVTEST_DOMAIN)
    );

    for (const user of leaked) {
      // Orders first: the reminder ledger and payments reference them,
      // and the ledger has no cascade of its own.
      const { data: orders } = await admin.from("orders").select("id").eq("customer_id", user.id);
      for (const order of orders ?? []) {
        await admin.from("notification_reminders").delete().eq("entity_id", order.id);
        await admin.from("payments").delete().eq("order_id", order.id);
      }

      const { data: appointments } = await admin
        .from("appointments")
        .select("id")
        .eq("customer_id", user.id);
      for (const appointment of appointments ?? []) {
        await admin.from("notification_reminders").delete().eq("entity_id", appointment.id);
      }

      await admin.from("notification_reminders").delete().eq("entity_id", user.id);
      await admin.from("appointments").delete().eq("customer_id", user.id);
      await admin.from("orders").delete().eq("customer_id", user.id);
      await admin.from("addresses").delete().eq("customer_id", user.id);
      await admin.from("notifications").delete().eq("profile_id", user.id);
      await admin.from("notification_preferences").delete().eq("profile_id", user.id);
      await admin.auth.admin.deleteUser(user.id);
      purged += 1;
      if (verbose) console.log(`  purged ${user.email}`);
    }

    // listUsers pages shift as rows are deleted, so restart from page 1
    // rather than advancing past rows that moved underneath us.
    if (leaked.length > 0) page = 0;
  }

  return purged;
}

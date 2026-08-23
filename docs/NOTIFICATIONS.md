# Notifications (Modules 15, 24 & 27)

## The one design decision worth knowing

**Preferences control email. The in-app feed is always on.**

A customer who has paid a four-figure deposit should not be able to switch off the in-app record
that their order shipped. That feed is their receipt trail, and "I muted it, then complained I was
never told" is a dispute nobody wins. Email is the intrusive channel and the one worth muting; the
feed is the record.

This is why `notification_preferences` has an `email_enabled` column and no `in_app_enabled`
counterpart — the absent column is the decision.

## How a notification comes to exist

```
templates.ts  ──▶  notify(supabase, { profileId, email, type, title, body, entityId })
                        │
                        ├─▶ notifications row        (always, when there is a profile)
                        ├─▶ email                    (if wants_email() and the admin switch is on)
                        └─▶ mock WhatsApp            (if a phone was passed)
```

`notify()` has 18 call sites. They pass a `type` from `templates.ts` and nothing about categories —
the category and the deep link are **derived** from that type inside `notify()` via
`lib/notifications/categories.ts`. That is why Module 27 added both without touching a single call
site. A new template gets its category by being added to one map, not by threading an extra
argument through eighteen places.

## Categories

`orders`, `payments`, `production`, `shipping`, `consultations`, `reviews`.

A type absent from the map gets a **null** category. That is not a bug: an unclassified
notification appears under no filter and is **never suppressed by a preference**. Unknown means
delivered, never dropped.

`marketing` is deliberately **not** a category. Marketing opt-out lives on
`profiles.marketing_opt_out` (Module 24), which the one-click unsubscribe link in every marketing
email already writes. A second switch for the same question would be a second source of truth, and
they would drift. The preferences screen surfaces that column rather than duplicating it.

## `wants_email()` fails OPEN — and that is deliberate

```sql
return coalesce(v_enabled, true);
```

This is the exact opposite of `has_permission()` (Module 26), which fails closed, and the
asymmetry is the point:

- A permission lookup that fails must **deny** — the cost of being wrong is unauthorised access.
- A transactional-email lookup that fails must **send** — the cost of being wrong is an unwanted
  email, against a customer never learning their order shipped.

An absent preference row therefore means *opted in*, so a customer who never opens the preferences
screen keeps receiving their order emails.

It is `SECURITY DEFINER` so it gives the same answer whether it is called from a user session or
from the reminder cron holding the service-role client.

## Pagination has a tiebreaker, and it is load-bearing

`getNotificationFeed` orders by `created_at DESC, id DESC`. The second key is not decoration.
Postgres guarantees no order between rows with equal sort keys, so paginating on `created_at`
alone lets a tie group reshuffle between requests — **the same row appears on two pages while
another is skipped entirely**.

Notifications tie routinely: `delivered` and `review_request` are written back-to-back by the same
action. `id` is a random uuid, so this is an arbitrary but *stable* order within a tie group,
which is exactly what pagination needs. The rows are simultaneous; there is no true order between
them to preserve.

This was found by a test that seeded 26 rows in one batch and asserted an ordering over them.

## Reminders (Pass 2)

`/api/cron/reminders`, daily at 10:00 via `vercel.json`. Two reminders:

- **Outstanding balances** — orders older than 7 days with `balance_due_amount > 0`, in a live
  status. Excludes `pending` (not yet a debt) and `cancelled` (no longer one); **includes**
  `delivered`, which is precisely the case worth chasing. Repeats at most every 14 days.
- **Consultations** — `confirmed` appointments falling in the next 48 hours, once each.

### Why a ledger and not a `last_reminded_at` column

`notification_reminders (entity_type, entity_id, kind)` — primary key on all three.

1. A messaging concern should not mutate a business table. Touching `orders` to record that an
   email went out bumps its `updated_at` and makes "when did this order last change" mean two
   different things.
2. **The primary key makes a double-send impossible rather than merely unlikely.** The cron claims
   first and sends second; a second attempt conflicts and skips. Two overlapping invocations
   cannot both win, because the loser loses at the database rather than at a timestamp it read a
   moment ago.
3. One table covers every future reminder kind without another migration per business table.

`kind` carries the occurrence (`payment_reminder_3`), so a balance can recur on a schedule while a
consultation reminder fires exactly once for a given booking.

**The accepted trade, stated plainly:** if the claim succeeds and the send then fails, that
reminder is *not* retried. A customer missing one reminder is a smaller harm than a customer
receiving the same chase-up email repeatedly. The failure is logged either way.

RLS is enabled on the ledger with only an admin **read** policy. Nothing grants write access to
any signed-in user — the cron uses the service-role client and bypasses RLS entirely, and a table
with RLS enabled and no matching policy denies by default.

## Verification

```
node --env-file=.env.local scripts/test-notifications.mjs        # Module 15 dispatch
node --env-file=.env.local scripts/test-notification-center.mjs  # Module 27 Pass 1
node --env-file=.env.local scripts/test-reminders.mjs            # Module 27 Pass 2
```

Pass 1 deliberately added a **new** script rather than extending `test-notifications.mjs`: a module
that edits the script it is also measured against has no regression gate at all.

## Known limitations

- **WhatsApp and SMS remain mocked.** Preferences cover in-app and email only.
- **No real-time push.** The unread badge updates on navigation, not over a socket.
- Guest appointments get no reminder. `appointments` carries no contact column of its own, so
  there is nothing to send to — skipping is more honest than pretending.
- `CRON_SECRET` is unset in local development, so the reminder route's auth check cannot be
  exercised there and its test records a SKIP rather than a false pass. **It must be set before
  deploy** — this endpoint emails customers.
- Supabase's built-in SMTP is rate-limited to roughly 2 emails/hour and is not for production.
  Custom SMTP must be configured in the Supabase dashboard before launch; note that **auth** emails
  (password reset, confirmation) go through Supabase's sender, not the app's Resend integration,
  and are configured separately.

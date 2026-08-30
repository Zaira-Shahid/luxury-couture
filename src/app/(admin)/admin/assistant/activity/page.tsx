import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getMcpFailureSummary,
  getMcpRecentFailures,
  getMcpToolStats,
} from "@/lib/mcp/get-activity";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Assistant activity" };

/**
 * Assistant activity (Module 43).
 *
 * WHAT THIS SCREEN IS FOR: the questions that were unanswerable until
 * this module. Which tools does the assistant actually use? What is it
 * being refused, and whose account is being refused it? Is something
 * failing rather than being denied? Before 0065 the only record of any
 * of that was a console line on a serverless host.
 *
 * GATED ON `settings.manage` (ADMIN_ROUTE_PERMISSIONS), unlike the
 * assistant screen itself, which any admin may open. The difference is
 * the data: the assistant shows you your own work, and this shows every
 * staff account's refusals side by side. That is operational data about
 * colleagues, and it belongs behind the same key that gates
 * `system_diagnostics` — the tool that answers the same kind of question.
 *
 * REFUSALS ARE NOT INCIDENTS. Most rows here are the system working: a
 * marketing account asked for an order and was told no. The screen says
 * so rather than styling every row as an alarm, because a dashboard that
 * cries wolf gets ignored and then misses the one row that mattered.
 */

const RANGES = [7, 30];
const DEFAULT_DAYS = 7;
const RECENT_LIMIT = 50;

/** Codes an operator should read as "working as designed" rather than "broken". */
const EXPECTED_REFUSALS = new Set(["FORBIDDEN", "UNAUTHORIZED", "NOT_FOUND", "VALIDATION_ERROR"]);

function resolveDays(value: string | undefined): number {
  const parsed = Number(value);
  return RANGES.includes(parsed) ? parsed : DEFAULT_DAYS;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function AssistantActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = resolveDays(daysParam);
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const [stats, failureSummary, recent] = await Promise.all([
    getMcpToolStats({ from, to }),
    getMcpFailureSummary({ from, to }),
    getMcpRecentFailures({ limit: RECENT_LIMIT, since: from }),
  ]);

  // Names for the refusal feed, in one query rather than one per row.
  // A refusal whose actor has since been deleted keeps its row and loses
  // its name — the event is still worth having (0065).
  const actorIds = [...new Set(recent.map((row) => row.actorId).filter((id): id is string => !!id))];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", actorIds);
    for (const row of (data ?? []) as { id: string; full_name: string | null }[]) {
      if (row.full_name) names.set(row.id, row.full_name);
    }
  }

  const totalCalls = stats.reduce((sum, row) => sum + row.calls, 0);
  const totalFailures = stats.reduce((sum, row) => sum + row.failures, 0);
  const totalConfirmations = stats.reduce((sum, row) => sum + row.confirmations, 0);
  const weightedDuration = stats.reduce(
    (sum, row) => sum + (row.avgDurationMs ?? 0) * row.calls,
    0
  );
  const avgDuration = totalCalls > 0 ? weightedDuration / totalCalls : null;
  const failureRate = totalCalls > 0 ? (totalFailures / totalCalls) * 100 : 0;

  const tiles = [
    { label: "Tool calls", value: formatNumber(totalCalls) },
    {
      label: "Refused or failed",
      value: `${formatNumber(totalFailures)}${totalCalls > 0 ? ` (${failureRate.toFixed(1)}%)` : ""}`,
    },
    { label: "Awaiting approval", value: formatNumber(totalConfirmations) },
    { label: "Average call", value: formatDuration(avgDuration) },
  ];

  return (
    <div className="container flex flex-col gap-10 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl">Assistant activity</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every MCP tool call is counted, and every refusal is kept with the arguments that
            caused it. Successful reads are counted but not stored — see{" "}
            <Link href="/admin/assistant" className="underline hover:text-foreground">
              the assistant
            </Link>{" "}
            for the chat itself.
          </p>
        </div>
        <nav aria-label="Date range" className="flex gap-1 text-sm">
          {RANGES.map((option) => (
            <Link
              key={option}
              href={`/admin/assistant/activity?days=${option}`}
              className={cn(
                "rounded-lg border px-3 py-1.5 transition-colors",
                days === option
                  ? "border-foreground/20 bg-muted font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {option}d
            </Link>
          ))}
        </nav>
      </div>

      {totalCalls === 0 && recent.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nothing recorded in this window</CardTitle>
            <CardDescription>
              Counting started with Module 43, so this stays empty until the assistant or an
              external MCP client makes a call. It is not evidence that nothing happened before
              that.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((tile) => (
              <Card key={tile.label}>
                <CardContent className="pt-6">
                  <dt className="text-sm text-muted-foreground">{tile.label}</dt>
                  <dd className="mt-1 font-heading text-2xl">{tile.value}</dd>
                </CardContent>
              </Card>
            ))}
          </dl>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">By tool</CardTitle>
              <CardDescription>
                Ordered by failures, then by volume. A tool with no rows has not been called in
                this window.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.length === 0 ? (
                <p className="text-sm text-muted-foreground">No calls in this window.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr className="border-b border-border">
                        <th scope="col" className="py-2 pr-4 font-medium">Tool</th>
                        <th scope="col" className="py-2 pr-4 text-right font-medium">Calls</th>
                        <th scope="col" className="py-2 pr-4 text-right font-medium">Refused/failed</th>
                        <th scope="col" className="py-2 pr-4 text-right font-medium">Awaiting approval</th>
                        <th scope="col" className="py-2 text-right font-medium">Average</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((row) => (
                        <tr key={row.toolName} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-4 font-mono text-xs">{row.toolName}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(row.calls)}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(row.failures)}</td>
                          <td className="py-2 pr-4 text-right">{formatNumber(row.confirmations)}</td>
                          <td className="py-2 text-right">{formatDuration(row.avgDurationMs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By reason</CardTitle>
                <CardDescription>
                  A permission refusal and a broken query are different problems with different
                  owners.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {failureSummary.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing was refused or failed.</p>
                ) : (
                  <ul className="flex flex-col gap-2 text-sm">
                    {failureSummary.map((row) => (
                      <li key={row.errorCode} className="flex items-center justify-between gap-4">
                        <span className="font-mono text-xs">{row.errorCode}</span>
                        <span className="text-muted-foreground">
                          {formatNumber(row.failures)}
                          {EXPECTED_REFUSALS.has(row.errorCode) ? "" : " — investigate"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent refusals</CardTitle>
                <CardDescription>
                  Newest {RECENT_LIMIT} in this window. Arguments are redacted before they are
                  stored: sensitive keys lose their values and long strings are truncated.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No refusals recorded in this window.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {recent.map((row) => (
                      <li key={row.id} className="rounded-lg border border-border p-3 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-mono text-xs">{row.toolName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatWhen(row.occurredAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          <span className="font-medium text-foreground">{row.errorCode}</span>
                          {" — "}
                          {row.actorId ? (names.get(row.actorId) ?? "a deleted account") : "unknown"}
                          {row.actorRole ? ` (${row.actorRole})` : ""}
                          {row.durationMs !== null ? `, ${formatDuration(row.durationMs)}` : ""}
                        </p>
                        {row.input ? (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-muted-foreground">
                              Arguments
                            </summary>
                            <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                              {JSON.stringify(row.input, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

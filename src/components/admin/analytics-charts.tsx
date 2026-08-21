import { FUNNEL_STEPS } from "@/lib/analytics/events";
import type { FunnelStep, TimeseriesRow } from "@/lib/admin/get-analytics";

/**
 * Charts for the admin analytics screen, hand-rolled as inline SVG.
 *
 * No charting library is installed and none is being added for two
 * visualisations — consistent with the Master Build Plan's free-first
 * rule and avoiding a dependency that would need maintaining forever.
 *
 * Design decisions worth keeping:
 *  - Every chart is SINGLE-SERIES, so there is no categorical palette to
 *    get wrong and no legend needed (each title names its own series).
 *    Colour comes from the design system's semantic tokens (Module 3), so
 *    light and dark themes are handled by globals.css rather than
 *    hardcoded hexes that would only work in one of them.
 *  - The trend is deliberately SMALL MULTIPLES, one mini chart per funnel
 *    step, each on its own scale. Plotting them together would either
 *    need two y-axes (never correct) or flatten "purchases" into the
 *    baseline, since product views outnumber them by an order of
 *    magnitude.
 *  - Bars start at zero, values are labelled directly rather than
 *    requiring an axis lookup, and the numbers are also present as text —
 *    so the data is never conveyed by mark length alone.
 */

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

/** Horizontal funnel bars — ordered magnitude with drop-off between steps. */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((s) => s.sessions), 1);

  return (
    <div className="flex flex-col gap-4">
      {steps.map((step, index) => {
        const widthPercent = (step.sessions / max) * 100;
        return (
          <div key={step.event}>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="font-medium text-foreground">{step.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatNumber(step.sessions)} session{step.sessions === 1 ? "" : "s"}
                {step.conversionFromPrevious !== null ? (
                  <>
                    {" · "}
                    <span className="text-foreground">
                      {formatPercent(step.conversionFromPrevious)}
                    </span>{" "}
                    of previous
                  </>
                ) : null}
              </span>
            </div>
            <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(widthPercent, step.sessions > 0 ? 1.5 : 0)}%` }}
                // The numbers above are the accessible source of truth;
                // this element is decorative reinforcement.
                aria-hidden
              />
            </div>
            {index < steps.length - 1 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatPercent(100 - (steps[index + 1].conversionFromPrevious ?? 0))} drop off before
                &ldquo;{steps[index + 1].label}&rdquo;
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** One sparkline. Single series, own scale, endpoints labelled only. */
function Sparkline({ points, label }: { points: { day: string; total: number }[]; label: string }) {
  const width = 240;
  const height = 56;
  const padding = 4;
  const max = Math.max(...points.map((p) => p.total), 1);
  const total = points.reduce((sum, p) => sum + p.total, 0);

  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const y = (value: number) => height - padding - (value / max) * (height - padding * 2);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${padding + i * step} ${y(p.total)}`)
    .join(" ");

  const last = points[points.length - 1];

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-heading tabular-nums">{formatNumber(total)}</p>
      {points.length > 1 ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mt-2 w-full"
          role="img"
          aria-label={`${label}: ${formatNumber(total)} over the period, peaking at ${formatNumber(max)} in a day.`}
        >
          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          />
          {last ? (
            <circle cx={padding + (points.length - 1) * step} cy={y(last.total)} r={4} className="fill-primary" />
          ) : null}
        </svg>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Not enough data to chart yet.</p>
      )}
    </div>
  );
}

export function FunnelTrends({ rows, days }: { rows: TimeseriesRow[]; days: number }) {
  // Build a dense per-day series per funnel event. The RPC gap-fills days
  // that have any events at all, but an event name with zero rows in the
  // whole window is absent entirely — default those to a flat zero line
  // rather than dropping the panel, so the set of panels stays stable.
  const byEvent = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!byEvent.has(row.event_name)) byEvent.set(row.event_name, new Map());
    byEvent.get(row.event_name)!.set(row.day, Number(row.total));
  }

  const allDays = [...new Set(rows.map((r) => r.day))].sort();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FUNNEL_STEPS.map((step) => {
        const series = byEvent.get(step.event) ?? new Map<string, number>();
        const points = allDays.map((day) => ({ day, total: series.get(day) ?? 0 }));
        return <Sparkline key={step.event} label={`${step.label} · ${days}d`} points={points} />;
      })}
    </div>
  );
}

/**
 * Pieces shared by the dashboard charts. No hooks here, so server components
 * (SourceBars) can use it as well as the client charts. The charts also serve
 * the public /stats page, so the language is an optional prop that defaults to
 * English.
 */

import { formatAdminNumber, makeAdminT, type AdminLang } from "@/lib/admin-lang";

/** Chrome colors shared by the dashboard charts: theme tokens, so the charts follow light and dark mode. */
export const CHART = {
  surface: "var(--surface-raised)",
  grid: "var(--hairline)",
  axisText: "var(--ink-faint)",
  hover: "var(--surface-sunken)",
  neutral: "var(--chart-neutral)",
  brand: "var(--brand)",
} as const;

export const fmt = (n: number, lang: AdminLang = "en") => formatAdminNumber(n, lang);

/** Round axis ticks from 0 that cover `max` in about `count` steps. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = 0; v < max + step; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/** Path for a column that grows from the baseline, rounded only at its data end. */
export function topRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

const TIP_W = 180;

/** Floating readout beside the hovered mark, never over it; `x` is the mark's center in px from the chart's left edge. */
export function Tooltip({ x, width, title, rows }: { x: number; width: number; title: string; rows: TooltipRow[] }) {
  const right = x + 16 + TIP_W <= width;
  const left = right ? x + 16 : Math.max(0, x - 16 - TIP_W);
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 rounded-lg border border-hairline bg-surface-raised px-3 py-2 text-xs shadow-neu-lg"
      style={{ left, width: TIP_W }}
    >
      <div className="mb-1 font-medium text-ink-muted">{title}</div>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            {r.color && <span className="h-0.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />}
            <span className="font-semibold tabular-nums text-ink">{r.value}</span>
            <span className="truncate text-ink-muted">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Every chart's accessible twin: the same numbers as a plain table. */
export function TableView({ head, rows, lang = "en" }: { head: string[]; rows: (string | number)[][]; lang?: AdminLang }) {
  const t = makeAdminT(lang);
  return (
    <details className="mt-3">
      <summary className="cursor-pointer select-none text-xs text-ink-muted hover:text-ink">{t("View as table")}</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-hairline">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-surface-sunken text-ink-muted">
            <tr>
              {head.map((h, i) => (
                <th key={h} className={`px-3 py-1.5 font-medium ${i ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((r) => (
              <tr key={String(r[0])}>
                {r.map((c, i) => (
                  <td key={i} className={`px-3 py-1.5 ${i ? "text-right tabular-nums" : ""}`}>
                    {typeof c === "number" ? fmt(c, lang) : c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

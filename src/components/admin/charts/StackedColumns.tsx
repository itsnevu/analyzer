"use client";

import { useState } from "react";
import { CHART, Legend, TableView, Tooltip, fmt, niceTicks, topRoundedRect } from "./chart-kit";
import { useWidth } from "./useWidth";

export interface StackSeries {
  key: string;
  label: string;
  color: string;
}

interface Props {
  /** one entry per column, e.g. years */
  labels: string[];
  /** stacking order, baseline first */
  series: StackSeries[];
  /** values[i][series.key] for column i */
  values: Record<string, number>[];
  unit: string;
  height?: number;
}

const M = { top: 20, right: 4, bottom: 22, left: 44 };
const GAP = 2;

export function StackedColumns({ labels, series, values, unit, height = 240 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const totals = values.map((v) => series.reduce((s, x) => s + (v[x.key] ?? 0), 0));
  const ticks = niceTicks(Math.max(...totals, 1));
  const yMax = ticks[ticks.length - 1];
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const band = labels.length ? plotW / labels.length : 0;
  const barW = Math.min(24, Math.max(3, band * 0.62));
  const y = (v: number) => M.top + plotH - (v / yMax) * plotH;
  const labelEvery = Math.max(1, Math.ceil(34 / Math.max(band, 1)));
  const peak = totals.indexOf(Math.max(...totals));
  const center = (i: number) => M.left + i * band + band / 2;

  return (
    <div>
      <Legend items={[...series].reverse()} />
      <div ref={ref} className="relative mt-3" style={{ height }} onPointerLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={`${unit} per ${labels[0]}–${labels[labels.length - 1]}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke={CHART.grid} strokeWidth={1} shapeRendering="crispEdges" />
                <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={CHART.axisText} className="tabular-nums">
                  {fmt(t)}
                </text>
              </g>
            ))}

            {active !== null && <rect x={M.left + active * band} y={M.top} width={band} height={plotH} fill={CHART.hover} />}

            {values.map((v, i) => {
              const x = center(i) - barW / 2;
              const drawn = series.filter((s) => (v[s.key] ?? 0) > 0);
              let base = y(0);
              return (
                <g key={labels[i]}>
                  {drawn.map((s, j) => {
                    // Each segment above the first gives up its bottom 2px as the gap to the one below.
                    const h = ((v[s.key] ?? 0) / yMax) * plotH;
                    const top = base - h;
                    const segH = h - (j > 0 ? GAP : 0);
                    base = top;
                    if (segH < 0.5) return null;
                    return j === drawn.length - 1 ? (
                      <path key={s.key} d={topRoundedRect(x, top, barW, segH, 4)} fill={s.color} />
                    ) : (
                      <rect key={s.key} x={x} y={top} width={barW} height={segH} fill={s.color} />
                    );
                  })}
                </g>
              );
            })}

            {totals[peak] > 0 && (
              <text x={center(peak)} y={y(totals[peak]) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink-muted)" className="tabular-nums">
                {fmt(totals[peak])}
              </text>
            )}

            {labels.map((l, i) =>
              // Every nth label, plus the last one; drop a regular label that would crowd the last.
              i === labels.length - 1 || (i % labelEvery === 0 && labels.length - 1 - i >= labelEvery) ? (
                <text
                  key={l}
                  x={Math.min(center(i), width - M.right)}
                  y={height - 6}
                  textAnchor={center(i) + 16 > width - M.right ? "end" : "middle"}
                  fontSize={11}
                  fill={CHART.axisText}
                  className="tabular-nums"
                >
                  {l}
                </text>
              ) : null,
            )}

            {labels.map((l, i) => (
              <rect
                key={l}
                x={M.left + i * band}
                y={M.top}
                width={band}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${l}: ${fmt(totals[i])} ${unit}`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                style={{ outline: "none" }}
              />
            ))}
          </svg>
        )}

        {active !== null && width > 0 && (
          <Tooltip
            x={center(active)}
            width={width}
            title={`${labels[active]} · ${fmt(totals[active])} ${unit}`}
            rows={[...series].reverse().map((s) => ({ label: s.label, value: fmt(values[active][s.key] ?? 0), color: s.color }))}
          />
        )}
      </div>

      <TableView
        head={["", ...series.map((s) => s.label), "Total"]}
        rows={labels.map((l, i) => [l, ...series.map((s) => values[i][s.key] ?? 0), totals[i]])}
      />
    </div>
  );
}

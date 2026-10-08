"use client";

import { useState } from "react";
import { formatAdminMonth } from "@/lib/admin-lang";
import { useAdminT } from "../AdminLang";
import { CHART, TableView, Tooltip, fmt, niceTicks, topRoundedRect } from "./chart-kit";
import { useWidth } from "./useWidth";

export interface MonthPoint {
  /** YYYY-MM */
  month: string;
  count: number;
  links: number;
}

const M = { top: 12, right: 4, bottom: 22, left: 36 };

/**
 * Single-series monthly columns. When one month dwarfs the rest (more than 3x
 * the runner-up) the axis is cut so the other months stay readable; the cut
 * bar gets a break mark and its real value printed beside it.
 */
export function MonthlyColumns({ points, height = 220 }: { points: MonthPoint[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  // Outside the admin panel (the public /stats page) there is no provider, so this is English.
  const { t, lang } = useAdminT();
  const monthLabel = (ym: string) => formatAdminMonth(ym, lang);
  const num = (n: number) => fmt(n, lang);

  const sorted = points.map((p) => p.count).sort((a, b) => b - a);
  const cut = sorted.length > 1 && sorted[0] > 3 * sorted[1] && sorted[0] > 20;
  const ticks = niceTicks(cut ? sorted[1] * 1.15 : Math.max(sorted[0] ?? 0, 1));
  const yMax = ticks[ticks.length - 1];
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const band = points.length ? plotW / points.length : 0;
  const barW = Math.min(24, Math.max(2, band * 0.7));
  const y = (v: number) => M.top + plotH - (Math.min(v, yMax) / yMax) * plotH;
  const center = (i: number) => M.left + i * band + band / 2;
  const yearStarts = points.map((p, i) => (i === 0 || p.month.endsWith("-01") ? i : -1)).filter((i) => i >= 0);

  return (
    <div>
      <div ref={ref} className="relative" style={{ height }} onPointerLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={t("Detector searches per month")}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={M.left} x2={width - M.right} y1={y(tick)} y2={y(tick)} stroke={CHART.grid} strokeWidth={1} shapeRendering="crispEdges" />
                <text x={M.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill={CHART.axisText} className="tabular-nums">
                  {num(tick)}
                </text>
              </g>
            ))}

            {points.map((p, i) => {
              if (!p.count) return null;
              const x = center(i) - barW / 2;
              const top = y(p.count);
              const over = p.count > yMax;
              const labelRight = center(i) < width - 60;
              return (
                <g key={p.month} opacity={active === null || active === i ? 1 : 0.55}>
                  <path d={topRoundedRect(x, top, barW, y(0) - top, 3)} fill={CHART.brand} />
                  {over && (
                    <>
                      <path d={`M${x - 2},${top + 14}L${x + barW + 2},${top + 9}V${top + 13}L${x - 2},${top + 18}Z`} fill={CHART.surface} />
                      <text
                        x={labelRight ? x + barW + 5 : x - 5}
                        y={top + 4}
                        dy="0.32em"
                        textAnchor={labelRight ? "start" : "end"}
                        fontSize={11}
                        fontWeight={600}
                        fill="var(--ink-muted)"
                        className="tabular-nums"
                      >
                        {num(p.count)}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            {yearStarts.map((i, k) => {
              const next = yearStarts[k + 1];
              if (next !== undefined && (next - i) * band < 30) return null;
              return (
                <text
                  key={points[i].month}
                  x={Math.min(M.left + i * band, width - M.right - 28)}
                  y={height - 6}
                  fontSize={11}
                  fill={CHART.axisText}
                  className="tabular-nums"
                >
                  {points[i].month.slice(0, 4)}
                </text>
              );
            })}

            {points.map((p, i) => (
              <rect
                key={p.month}
                x={M.left + i * band}
                y={M.top}
                width={band}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={t("{month}: {n} searches", { month: monthLabel(p.month), n: p.count })}
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
            title={monthLabel(points[active].month)}
            rows={[
              { label: t("searches"), value: num(points[active].count), color: CHART.brand },
              { label: t("pasted links"), value: num(points[active].links) },
            ]}
          />
        )}
      </div>

      {cut &&
        points
          .filter((p) => p.count > yMax)
          .map((p) => (
            <p key={p.month} className="mt-2 text-xs text-ink-faint">
              {t("The scale stops at {max} so the other months stay readable. {month} goes past it: {n} searches, {links} of them pasted links.", {
                max: yMax,
                month: monthLabel(p.month),
                n: p.count,
                links: p.links,
              })}
            </p>
          ))}

      <TableView
        head={[t("Month"), t("Searches"), t("Pasted links")]}
        rows={points.filter((p) => p.count).map((p) => [monthLabel(p.month), p.count, p.links])}
        lang={lang}
      />
    </div>
  );
}

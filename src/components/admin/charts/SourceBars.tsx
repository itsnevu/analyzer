import { CHART, Legend, TableView, fmt } from "./chart-kit";

export interface SourceBar {
  name: string;
  lang: string;
  labeled: number;
  unlabeled: number;
}

/** Horizontal bars, labeled rows first and unlabeled rows after a 2px gap. */
export function SourceBars({ rows }: { rows: SourceBar[] }) {
  const max = Math.max(...rows.map((r) => r.labeled + r.unlabeled), 1);
  return (
    <div>
      <Legend
        items={[
          { label: "Labeled", color: CHART.brand },
          { label: "Unlabeled", color: CHART.neutral },
        ]}
      />
      <ul className="mt-3 space-y-1">
        {rows.map((r) => {
          const total = r.labeled + r.unlabeled;
          return (
            <li
              key={r.name}
              className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-surface-sunken"
              title={`${r.name}: ${fmt(r.labeled)} labeled, ${fmt(r.unlabeled)} unlabeled`}
            >
              <span className="truncate text-xs text-ink-muted">
                {r.name}
                {r.lang && <span className="ml-1.5 font-mono text-[10px] uppercase text-ink-faint">{r.lang}</span>}
              </span>
              <span className="flex h-3.5 items-center" style={{ width: `${(total / max) * 100}%` }}>
                {r.labeled > 0 && (
                  <span
                    className="h-full"
                    style={{
                      width: `${(r.labeled / total) * 100}%`,
                      background: CHART.brand,
                      borderRadius: r.unlabeled > 0 ? 0 : "0 4px 4px 0",
                      minWidth: 2,
                    }}
                  />
                )}
                {r.unlabeled > 0 && (
                  <span
                    className="h-full"
                    style={{
                      width: `${(r.unlabeled / total) * 100}%`,
                      background: CHART.neutral,
                      borderRadius: "0 4px 4px 0",
                      marginLeft: r.labeled > 0 ? 2 : 0,
                      minWidth: 2,
                    }}
                  />
                )}
              </span>
              <span className="text-right text-xs tabular-nums">
                <span className="font-semibold text-ink">{fmt(r.labeled)}</span>
                {r.unlabeled > 0 && <span className="text-ink-faint"> + {fmt(r.unlabeled)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <TableView
        head={["Source", "Labeled", "Unlabeled", "Total"]}
        rows={rows.map((r) => [r.name, r.labeled, r.unlabeled, r.labeled + r.unlabeled])}
      />
    </div>
  );
}

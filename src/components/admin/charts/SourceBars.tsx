import { makeAdminT, tk, type AdminLang } from "@/lib/admin-lang";
import { CHART, Legend, TableView, fmt } from "./chart-kit";

export interface SourceBar {
  name: string;
  lang: string;
  labeled: number;
  unlabeled: number;
}

const DEFAULT_LEGEND = { labeled: tk("Labeled"), unlabeled: tk("Unlabeled") };

/**
 * Horizontal bars, labeled rows first and unlabeled rows after a 2px gap.
 * `legend` renames the two series for other splits (e.g. "With full text" / "Link only").
 * `lang` is the admin panel's language (English by default, for the public /stats page).
 */
export function SourceBars({
  rows,
  legend = DEFAULT_LEGEND,
  lang = "en",
}: {
  rows: SourceBar[];
  legend?: { labeled: string; unlabeled: string };
  lang?: AdminLang;
}) {
  const t = makeAdminT(lang);
  const num = (n: number) => fmt(n, lang);
  const labeledName = t(legend.labeled);
  const unlabeledName = t(legend.unlabeled);
  const max = Math.max(...rows.map((r) => r.labeled + r.unlabeled), 1);
  return (
    <div>
      <Legend
        items={[
          { label: labeledName, color: CHART.brand },
          { label: unlabeledName, color: CHART.neutral },
        ]}
      />
      <ul className="mt-3 space-y-1">
        {rows.map((r) => {
          const total = r.labeled + r.unlabeled;
          return (
            <li
              key={r.name}
              className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-surface-sunken"
              title={`${r.name}: ${num(r.labeled)} ${labeledName.toLowerCase()}, ${num(r.unlabeled)} ${unlabeledName.toLowerCase()}`}
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
                <span className="font-semibold text-ink">{num(r.labeled)}</span>
                {r.unlabeled > 0 && <span className="text-ink-faint"> + {num(r.unlabeled)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <TableView
        head={[t("Source"), labeledName, unlabeledName, t("Total")]}
        rows={rows.map((r) => [r.name, r.labeled, r.unlabeled, r.labeled + r.unlabeled])}
        lang={lang}
      />
    </div>
  );
}

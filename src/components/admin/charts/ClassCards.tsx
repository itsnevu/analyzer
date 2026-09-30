import { CLASS_META, type DatasetClass } from "@/lib/dataset-classes";
import { fmt } from "./chart-kit";

const ORDER: DatasetClass[] = ["HOAX", "DISINFORMATION", "INFORMATION", "FACT"];

const ICONS: Record<DatasetClass, React.ReactNode> = {
  HOAX: <path d="M15 9l-6 6m0-6l6 6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  DISINFORMATION: <path d="M12 9v4m0 4h.01M10.3 3.9L2.4 17.5A2 2 0 004.1 20.5h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />,
  INFORMATION: <path d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  FACT: <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
};

/** One card per class of the legacy detector's dataset, with its share of the labeled rows. */
export function ClassCards({ byClass, labeled }: { byClass: Record<DatasetClass, number>; labeled: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ORDER.map((key) => {
        const { label, color } = CLASS_META[key];
        const share = labeled ? (byClass[key] / labeled) * 100 : 0;
        return (
          <div key={key} className="neu flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-ink-muted">{label}</span>
              <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${color}1f`, color }}>
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {ICONS[key]}
                </svg>
              </span>
            </div>
            <div>
              <div className="text-3xl font-semibold tracking-tight">{fmt(byClass[key])}</div>
              <div className="mt-0.5 text-xs text-ink-faint">{share.toFixed(1)}% of labeled rows</div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: `${color}26` }} aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${share}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { ModelPanel } from "@/components/admin/ModelPanel";
import { baselineInfo, modelStatus, retrainSchedule } from "@/lib/baseline";
import { clsx } from "@/lib/clsx";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Model" };

const ENGINES: { key: "external" | "baseline" | "heuristic"; name: string; what: string }[] = [
  {
    key: "external",
    name: "External model (optional)",
    what: "Any HTTP service that follows the contract in src/lib/detect.ts, reached when MODEL_API_URL is set. Its verdict is final; an archive match is only listed next to it.",
  },
  {
    key: "baseline",
    name: "Trained classifier",
    what: "The site's own detection model: logistic regression over the words and word pairs of the archive's fact-checks, trained here. A matching archived fact-check still overrides its verdict.",
  },
  {
    key: "heuristic",
    name: "Keyword heuristic",
    what: "A fixed list of clickbait and credibility phrases plus shouting and exclamation marks. Only used before a classifier has been trained, or when the classifier knows none of the words in a text; marked as demo mode on the public page.",
  },
];

export default function ModelPage() {
  const status = modelStatus();
  const info = baselineInfo();
  const schedule = retrainSchedule(getDb());
  const state = (key: (typeof ENGINES)[number]["key"]) =>
    key === "external" ? (status.external.configured ? "configured" : "not configured") : key === "baseline" ? (status.baseline ? "trained" : "no model file") : "always available";

  return (
    <div className="space-y-4">
      <div className="neu p-6">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">Model</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          A public check is answered by the first engine below that is available. Only the keyword heuristic is marked as demo mode on the
          public page; whenever the external model did not answer, a matching archived fact-check overrides the verdict.
        </p>
        <ol className="mt-5 grid gap-3 md:grid-cols-3">
          {ENGINES.map((e, i) => {
            const active = status.engine === e.key;
            return (
              <li key={e.key} className={clsx("rounded-lg border p-4", active ? "border-ink bg-surface-sunken" : "border-hairline")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">{i + 1}</span>
                  <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", active ? "bg-ink text-surface-raised" : "bg-surface-sunken text-ink-faint")}>
                    {active ? "answering now" : state(e.key)}
                  </span>
                </div>
                <div className="mt-2 font-semibold">{e.name}</div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{e.what}</p>
              </li>
            );
          })}
        </ol>
      </div>

      <ModelPanel initialStatus={status} initialInfo={info} initialSchedule={schedule} />
    </div>
  );
}

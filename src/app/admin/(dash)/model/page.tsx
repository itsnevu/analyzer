import type { Metadata } from "next";
import { ModelPanel } from "@/components/admin/ModelPanel";
import { tk } from "@/lib/admin-lang";
import { getAdminT } from "@/lib/admin-lang-server";
import { baselineInfo, modelStatus, retrainSchedule } from "@/lib/baseline";
import { clsx } from "@/lib/clsx";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminT();
  return { title: t("Model") };
}

const ENGINES: { key: "external" | "baseline" | "heuristic"; name: string; what: string }[] = [
  {
    key: "external",
    name: tk("External model (optional)"),
    what: tk(
      "A separate prediction service on another server, used only when MODEL_API_URL is set (see src/lib/detect.ts). Its verdict is final; a matching archive entry is only shown next to it.",
    ),
  },
  {
    key: "baseline",
    name: tk("Trained model"),
    what: tk(
      "The site's own model, trained here from the archive's fact-checks: it learns which words and word pairs go with each verdict. If the text matches an archived fact-check, that fact-check's verdict wins.",
    ),
  },
  {
    key: "heuristic",
    name: tk("Keyword rules"),
    what: tk(
      "A fixed list of clickbait and trust phrases, plus ALL CAPS and stacked exclamation marks. Used only before a model is trained, or when the model knows none of the words. The public page then says it is in demo mode.",
    ),
  },
];

export default async function ModelPage() {
  await requireAdmin();
  const { t } = await getAdminT();
  const status = modelStatus();
  const info = baselineInfo();
  const schedule = retrainSchedule(getDb());
  const state = (key: (typeof ENGINES)[number]["key"]) =>
    key === "external" ? (status.external.configured ? t("Set up") : t("Not set up")) : key === "baseline" ? (status.baseline ? t("Trained") : t("No model file")) : t("Always available");

  return (
    <div className="space-y-4">
      <div className="neu p-6">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">{t("Model")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          {t(
            "Which engine answers the public hoax checks, how accurate the trained model is, and a box to try it. Each check is answered by the first engine below that is available.",
          )}
        </p>
        <ol className="mt-5 grid gap-3 md:grid-cols-3">
          {ENGINES.map((e, i) => {
            const active = status.engine === e.key;
            return (
              <li key={e.key} className={clsx("rounded-lg border p-4", active ? "border-ink bg-surface-sunken" : "border-hairline")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-ink-faint">{i + 1}</span>
                  <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider", active ? "bg-ink text-surface-raised" : "bg-surface-sunken text-ink-faint")}>
                    {active ? t("Answering now") : state(e.key)}
                  </span>
                </div>
                <div className="mt-2 font-semibold">{t(e.name)}</div>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t(e.what)}</p>
              </li>
            );
          })}
        </ol>
      </div>

      <ModelPanel initialStatus={status} initialInfo={info} initialSchedule={schedule} />
    </div>
  );
}

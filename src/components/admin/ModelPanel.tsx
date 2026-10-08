"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminT } from "@/components/admin/AdminLang";
import { adminLocale, formatAdminDateTime, formatAdminNumber, tk, type AdminLang, type AdminT } from "@/lib/admin-lang";
import type { ArchiveLang, BaselineMetrics, BaselinePrediction, ModelStatus, RetrainSchedule } from "@/lib/baseline";
import type { PingResult } from "@/lib/detect";
import { VERDICT_META } from "@/lib/verdict";
import { clsx } from "@/lib/clsx";

type Info = (BaselineMetrics & { path: string; sizeBytes: number }) | null;
type Verdict = keyof typeof VERDICT_META;

const CLASSES: Verdict[] = ["hoax", "misleading", "valid"];
const LANGS: { key: ArchiveLang; name: string }[] = [
  { key: "id", name: tk("Indonesian") },
  { key: "en", name: tk("English") },
];
const TEXT_VARIANT: Record<string, string> = {
  claim: tk("Claim only"),
  "claim+explanation": tk("Claim + explanation"),
};
const oneDecimal = (v: number, lang: AdminLang) => v.toLocaleString(adminLocale(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (v: number, lang: AdminLang) => `${oneDecimal(v * 100, lang)}%`;
const mb = (bytes: number, lang: AdminLang) =>
  bytes >= 1024 * 1024 ? `${oneDecimal(bytes / 1024 / 1024, lang)} MB` : `${formatAdminNumber(Math.round(bytes / 1024), lang)} KB`;
const field = "w-full rounded-lg border border-hairline bg-surface-sunken px-3.5 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";
const subhead = "mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint";

const SAMPLE = "Vaksin COVID-19 mengandung chip magnet yang bisa melacak lokasi kita. Sebarkan ke keluarga sebelum dihapus!";

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]" aria-hidden />;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-hairline pb-1.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

/** "Next automatic retraining", in words. */
function nextRetrain(s: RetrainSchedule, t: AdminT, lang: AdminLang): string {
  if (s.days === 0) return t("Off (BASELINE_RETRAIN_DAYS=0)");
  const here = s.runsHere;
  if (s.nextAt) {
    if (Date.parse(s.nextAt) <= Date.now()) return here ? t("At the next hourly check") : t("At the next hourly check (on the live server only)");
    const date = formatAdminDateTime(s.nextAt, lang);
    return here ? date : t("{date} (on the live server only)", { date });
  }
  if (s.dueAt && Date.parse(s.dueAt) > Date.now()) {
    const date = formatAdminDateTime(s.dueAt, lang);
    return here ? t("{date}, if the archive has changed by then", { date }) : t("{date}, if the archive has changed by then (on the live server only)", { date });
  }
  return here ? t("When the archive next changes (checked every hour)") : t("When the archive next changes (checked every hour, on the live server only)");
}

function Dot({ verdict }: { verdict: Verdict }) {
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: VERDICT_META[verdict].color }} aria-hidden />;
}

export function ModelPanel({ initialStatus, initialInfo, initialSchedule }: { initialStatus: ModelStatus; initialInfo: Info; initialSchedule: RetrainSchedule }) {
  const router = useRouter();
  const { t, lang } = useAdminT();
  const n = (v: number) => formatAdminNumber(v, lang);
  const p = (v: number) => pct(v, lang);
  const verdictName = (v: Verdict) => t(VERDICT_META[v].label);
  const [status, setStatus] = useState(initialStatus);
  const [info, setInfo] = useState<Info>(initialInfo);
  const [schedule, setSchedule] = useState(initialSchedule);

  const [pinging, setPinging] = useState(false);
  const [ping, setPing] = useState<PingResult | null>(null);
  const [pingError, setPingError] = useState<string | null>(null);

  const [training, setTraining] = useState(false);
  const [trainError, setTrainError] = useState<string | null>(null);
  const [trainedNow, setTrainedNow] = useState(false);

  const [text, setText] = useState(SAMPLE);
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<(BaselinePrediction & { ms: number }) | null>(null);
  const [predictError, setPredictError] = useState<string | null>(null);

  async function doPing() {
    setPinging(true);
    setPingError(null);
    setPing(null);
    try {
      setPing(await post<PingResult>("/api/admin/model/ping"));
    } catch (err) {
      setPingError(err instanceof Error ? err.message : t("The connection test failed."));
    } finally {
      setPinging(false);
    }
  }

  async function doTrain() {
    setTraining(true);
    setTrainError(null);
    setTrainedNow(false);
    try {
      const r = await post<{ status: ModelStatus; baseline: Info; schedule: RetrainSchedule }>("/api/admin/model/train");
      setStatus(r.status);
      setInfo(r.baseline);
      setSchedule(r.schedule);
      setTrainedNow(true);
      setPrediction(null);
      router.refresh();
    } catch (err) {
      setTrainError(err instanceof Error ? err.message : t("Training failed."));
    } finally {
      setTraining(false);
    }
  }

  async function doPredict(e: React.FormEvent) {
    e.preventDefault();
    setPredicting(true);
    setPredictError(null);
    try {
      setPrediction(await post<BaselinePrediction & { ms: number }>("/api/admin/model/predict", { text }));
    } catch (err) {
      setPrediction(null);
      setPredictError(err instanceof Error ? err.message : t("The text could not be checked."));
    } finally {
      setPredicting(false);
    }
  }

  const ext = status.external;
  const yesNo = (v: boolean) => (v ? t("Yes") : t("No"));

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-5">
        {/* External model */}
        <div className="neu p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">{t("External model")}</h2>
              <p className="mt-0.5 text-sm text-ink-faint">{t("Optional: a separate prediction service that follows the format in src/lib/detect.ts.")}</p>
            </div>
            <span className={clsx("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", ext.configured ? "bg-verdict-valid/10 text-verdict-valid" : "bg-surface-sunken text-ink-faint")}>
              {ext.configured ? t("Set up") : t("Not set up")}
            </span>
          </div>
          <dl className="mt-4 space-y-1.5 text-sm">
            <Row label={t("Address")} value={ext.host ?? <span className="text-ink-faint">{t("MODEL_API_URL is empty")}</span>} />
            <Row label={t("Time limit")} value={`${n(ext.timeoutMs)} ms`} />
            <Row label={t("API key")} value={<span className="text-ink-faint">{t("Never shown here")}</span>} />
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={doPing} disabled={!ext.configured || pinging} className="neu-btn px-4 py-2 text-sm disabled:opacity-50">
              {pinging ? (
                <>
                  <Spinner /> {t("Testing…")}
                </>
              ) : (
                t("Test connection")
              )}
            </button>
            {!ext.configured && <span className="text-sm text-ink-faint">{t("To connect one, set MODEL_API_URL in .env and restart the site.")}</span>}
          </div>
          {pingError && <p className="mt-3 text-sm text-verdict-hoax">{pingError}</p>}
          {ping && (
            <dl className="mt-4 space-y-1.5 text-sm">
              <Row label={t("Reachable")} value={yesNo(ping.reachable)} />
              <Row label={t("HTTP status")} value={ping.status ?? "—"} />
              <Row label={t("Response time")} value={ping.latencyMs != null ? `${n(ping.latencyMs)} ms` : "—"} />
              <Row label={t("Answers in the expected format")} value={yesNo(ping.contract)} />
              {ping.model && <Row label={t("Model name")} value={ping.model} />}
              {ping.verdict && (
                <Row
                  label={t("Verdict for a sample text")}
                  value={ping.hoaxProbability != null ? t("{verdict} ({pct} hoax)", { verdict: ping.verdict, pct: p(ping.hoaxProbability) }) : ping.verdict}
                />
              )}
              {ping.error && <Row label={t("Problem")} value={<span className="text-verdict-hoax">{ping.error}</span>} />}
            </dl>
          )}
        </div>

        {/* Baseline */}
        <div className="neu p-5 lg:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">{t("Trained model")}</h2>
              <p className="mt-0.5 text-sm text-ink-faint">
                {t("Learns which words and word pairs appear in hoax, misleading and credible fact-checks (logistic regression on TF-IDF).")}{" "}
                {t("Command line:")} <code className="font-mono text-xs">npm run train:baseline</code>
              </p>
            </div>
            <span className={clsx("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", info ? "bg-verdict-valid/10 text-verdict-valid" : "bg-verdict-warn/10 text-verdict-warn")}>
              {info ? t("Trained") : t("No model file")}
            </span>
          </div>

          {info ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <dl className="space-y-1.5 text-sm">
                <Row label={t("Trained on")} value={formatAdminDateTime(info.trainedAt, lang)} />
                <Row label={t("Fact-checks used for training")} value={n(info.docs)} />
                <Row label={t("Fact-checks kept aside for testing")} value={n(info.holdout)} />
                <Row label={t("Words and word pairs learned")} value={n(info.features)} />
                <Row label={t("Text used")} value={TEXT_VARIANT[info.textVariant] ? t(TEXT_VARIANT[info.textVariant]) : info.textVariant} />
                <Row label={t("Temperature (confidence tuning)")} value={info.temperature.toLocaleString(adminLocale(lang))} />
                <Row label={t("Model file size")} value={mb(info.sizeBytes, lang)} />
                <Row
                  label={t("Automatic retraining")}
                  value={schedule.days === 0 ? t("Off") : schedule.days === 1 ? t("Every day") : t("Every {n} days", { n: schedule.days })}
                />
                <Row label={t("Next automatic retraining")} value={nextRetrain(schedule, t, lang)} />
                <Row
                  label={t("Archive changed since training")}
                  value={schedule.archiveChanged == null ? "—" : schedule.archiveChanged ? <span className="text-verdict-warn">{t("Yes")}</span> : t("No")}
                />
              </dl>
              <div className="grid grid-cols-2 gap-3">
                <div className="neu-inset p-4">
                  <div className="text-2xl font-semibold tabular-nums">{p(info.accuracy)}</div>
                  <div className="text-sm text-ink-muted">{t("Right on fact-checks it never saw (accuracy)")}</div>
                </div>
                <div className="neu-inset p-4">
                  <div className="text-2xl font-semibold tabular-nums">{p(info.macroF1)}</div>
                  <div className="text-sm text-ink-muted">{t("Balanced score over the three verdicts (macro-F1)")}</div>
                </div>
                <p className="col-span-2 text-sm leading-relaxed text-ink-faint">
                  {t(
                    "The test set is 10% of the archive, taken evenly from each verdict, that the model never saw while learning. The archive holds fact-checks only, so the model learns which claims fact-checkers debunked or confirmed. It does not check facts itself, and topics the archive only ever debunked look hoax-prone to it.",
                  )}
                </p>
              </div>

              <div className="overflow-x-auto">
                <h3 className={subhead}>{t("Per verdict")}</h3>
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-ink-faint">
                    <tr>
                      {[t("Verdict"), t("Precision"), t("Recall"), "F1", t("Test rows")].map((h) => (
                        <th key={h} className="pb-1.5 pr-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CLASSES.map((c) => (
                      <tr key={c} className="border-t border-hairline">
                        <td className="py-1.5 pr-3">
                          <Dot verdict={c} /> {verdictName(c)}
                        </td>
                        <td className="pr-3 tabular-nums">{p(info.perClass[c].precision)}</td>
                        <td className="pr-3 tabular-nums">{p(info.perClass[c].recall)}</td>
                        <td className="pr-3 tabular-nums">{p(info.perClass[c].f1)}</td>
                        <td className="tabular-nums">{n(info.perClass[c].support)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
                  {t("Precision: how often it is right when it gives this verdict. Recall: how many of these it finds. F1: the two combined.")}
                </p>
              </div>

              <div className="overflow-x-auto">
                <h3 className={subhead}>{t("Mix-ups (rows: real verdict, columns: the model's answer)")}</h3>
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-ink-faint">
                    <tr>
                      <th className="pb-1.5 pr-3 font-medium" />
                      {CLASSES.map((c) => (
                        <th key={c} className="pb-1.5 pr-3 font-medium">
                          {verdictName(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {info.confusion.map((row, i) => (
                      <tr key={CLASSES[i]} className="border-t border-hairline">
                        <td className="py-1.5 pr-3">
                          <Dot verdict={CLASSES[i]} /> {verdictName(CLASSES[i])}
                        </td>
                        {row.map((v, j) => (
                          <td key={j} className={clsx("pr-3 tabular-nums", i === j && "font-semibold")}>
                            {n(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto md:col-span-2">
                <h3 className={subhead}>{t("Per language (test set)")}</h3>
                {info.perLanguage ? (
                  <>
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-ink-faint">
                        <tr>
                          {[t("Language"), t("Test rows"), t("Accuracy"), "Macro-F1", ...CLASSES.map((c) => t("{verdict} F1", { verdict: verdictName(c) }))].map((h) => (
                            <th key={h} className="pb-1.5 pr-3 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {LANGS.map(({ key, name }) => {
                          const m = info.perLanguage![key];
                          return (
                            <tr key={key} className="border-t border-hairline">
                              <td className="py-1.5 pr-3">{t(name)}</td>
                              <td className="pr-3 tabular-nums">{n(m.holdout)}</td>
                              <td className="pr-3 tabular-nums">{m.holdout ? p(m.accuracy) : "—"}</td>
                              <td className="pr-3 tabular-nums">{m.holdout ? p(m.macroF1) : "—"}</td>
                              {CLASSES.map((c) => (
                                <td key={c} className="pr-3 tabular-nums" title={t("{n} test rows", { n: m.perClass[c].support })}>
                                  {m.perClass[c].support ? p(m.perClass[c].f1) : "—"}
                                  <span className="ml-1 text-ink-faint">({n(m.perClass[c].support)})</span>
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
                      {t("Test rows per verdict are in brackets. There are few English fact-checks and most are hoaxes, so the English figures rest on few rows.")}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-ink-muted">{t("This model file is older than the per-language report. Train again to see it.")}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">
              {t(
                "There is no model file yet, so public checks use the keyword rules and are marked as demo mode. Train one from the published fact-checks; it takes a second or two.",
              )}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button onClick={doTrain} disabled={training} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {training ? (
                <>
                  <Spinner /> {t("Training…")}
                </>
              ) : info ? (
                t("Train again")
              ) : (
                t("Train now")
              )}
            </button>
            <span className="text-sm text-ink-faint">{t("Reads the published articles and replaces the model file. The site uses the new model from the next check on.")}</span>
          </div>
          {trainError && <p className="mt-3 text-sm text-verdict-hoax">{trainError}</p>}
          {trainedNow && !trainError && <p className="mt-3 text-sm text-verdict-valid">{t("Trained. The figures above are from the new model.")}</p>}
        </div>
      </div>

      {/* Try it */}
      <div className="neu p-5">
        <h2 className="font-display text-lg font-bold">{t("Try it")}</h2>
        <p className="mt-0.5 text-sm text-ink-faint">
          {t("The trained model's own answer, without the archive match the public detector adds on top. Nothing typed here is saved.")}
        </p>
        <form onSubmit={doPredict} className="mt-4 space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className={field} placeholder={t("Paste a claim or a message…")} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={predicting || !info || text.trim().length < 3} className="neu-btn px-4 py-2 text-sm disabled:opacity-50">
              {predicting ? (
                <>
                  <Spinner /> {t("Checking…")}
                </>
              ) : (
                t("Check")
              )}
            </button>
            {!info && <span className="text-sm text-ink-faint">{t("Train a model first.")}</span>}
          </div>
        </form>
        {predictError && <p className="mt-3 text-sm text-verdict-hoax">{predictError}</p>}
        {prediction && (
          <div className="mt-4 grid gap-4 md:grid-cols-[auto_1fr]">
            <div className="neu-inset min-w-56 p-4">
              <div className="flex items-center gap-2 font-display text-xl font-bold" style={{ color: VERDICT_META[prediction.verdict].color }}>
                <Dot verdict={prediction.verdict} /> {verdictName(prediction.verdict)}
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                {CLASSES.map((c) => (
                  <div key={c} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2">
                    <dt className="text-ink-muted">{verdictName(c)}</dt>
                    <dd className="h-2 overflow-hidden rounded bg-surface-sunken">
                      <div className="h-full rounded" style={{ width: `${prediction.probabilities[c] * 100}%`, background: VERDICT_META[c].color }} />
                    </dd>
                    <dd className="text-right tabular-nums">{p(prediction.probabilities[c])}</dd>
                  </div>
                ))}
              </dl>
              <dl className="mt-3 space-y-1.5 text-sm">
                <Row label={t("Chance of hoax shown to visitors")} value={p(prediction.hoaxProbability)} />
                <Row label={t("Confidence")} value={p(prediction.confidence)} />
                <Row label={t("Time")} value={`${n(prediction.ms)} ms`} />
              </dl>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{t("Words that weighed most")}</h3>
              <p className="mt-1 text-sm text-ink-faint">{t("How much each word pushed the answer: ▲ toward hoax, ✓ toward credible.")}</p>
              {prediction.topFeatures.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {prediction.topFeatures.map((f) => (
                    <li
                      key={f.token}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium"
                      style={{
                        color: f.kind === "risk" ? "var(--hoax)" : "var(--valid)",
                        background: `color-mix(in srgb, ${f.kind === "risk" ? "var(--hoax)" : "var(--valid)"} 12%, transparent)`,
                      }}
                    >
                      <span className="text-[10px]">{f.kind === "risk" ? "▲" : "✓"}</span>
                      {f.token}
                      <span className="tabular-nums opacity-70">
                        {f.weight > 0 ? "+" : ""}
                        {f.weight.toLocaleString(adminLocale(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">{t("No word in this text carries weight on its own.")}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

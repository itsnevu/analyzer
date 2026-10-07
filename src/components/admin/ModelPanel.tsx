"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BaselineMetrics, BaselinePrediction, ModelStatus } from "@/lib/baseline";
import type { PingResult } from "@/lib/detect";
import { VERDICT_META } from "@/lib/verdict";
import { clsx } from "@/lib/clsx";

type Info = (BaselineMetrics & { path: string; sizeBytes: number }) | null;
type Verdict = keyof typeof VERDICT_META;

const CLASSES: Verdict[] = ["hoax", "misleading", "valid"];
const n = (v: number) => v.toLocaleString("en-US");
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const mb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
const field = "w-full rounded-lg border border-hairline bg-surface-sunken px-3.5 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";

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

function Dot({ verdict }: { verdict: Verdict }) {
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: VERDICT_META[verdict].color }} aria-hidden />;
}

export function ModelPanel({ initialStatus, initialInfo }: { initialStatus: ModelStatus; initialInfo: Info }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [info, setInfo] = useState<Info>(initialInfo);

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
      setPingError(err instanceof Error ? err.message : "Ping failed.");
    } finally {
      setPinging(false);
    }
  }

  async function doTrain() {
    setTraining(true);
    setTrainError(null);
    setTrainedNow(false);
    try {
      const r = await post<{ status: ModelStatus; baseline: Info }>("/api/admin/model/train");
      setStatus(r.status);
      setInfo(r.baseline);
      setTrainedNow(true);
      setPrediction(null);
      router.refresh();
    } catch (err) {
      setTrainError(err instanceof Error ? err.message : "Training failed.");
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
      setPredictError(err instanceof Error ? err.message : "Prediction failed.");
    } finally {
      setPredicting(false);
    }
  }

  const ext = status.external;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-5">
        {/* External model */}
        <div className="neu p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">External model</h2>
              <p className="mt-0.5 text-xs text-ink-faint">RAG Fusion over HTTP, see the contract in src/lib/detect.ts</p>
            </div>
            <span className={clsx("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", ext.configured ? "bg-verdict-valid/10 text-verdict-valid" : "bg-surface-sunken text-ink-faint")}>
              {ext.configured ? "configured" : "not configured"}
            </span>
          </div>
          <dl className="mt-4 space-y-1.5 text-sm">
            <Row label="Host" value={ext.host ?? <span className="text-ink-faint">RAG_FUSION_API_URL is empty</span>} />
            <Row label="Timeout" value={`${n(ext.timeoutMs)} ms`} />
            <Row label="API key" value={<span className="text-ink-faint">never shown here</span>} />
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={doPing} disabled={!ext.configured || pinging} className="neu-btn px-4 py-2 text-sm disabled:opacity-50">
              {pinging ? <><Spinner /> Pinging…</> : "Ping"}
            </button>
            {!ext.configured && <span className="text-xs text-ink-faint">Set RAG_FUSION_API_URL in .env and restart to connect one.</span>}
          </div>
          {pingError && <p className="mt-3 text-sm text-verdict-hoax">{pingError}</p>}
          {ping && (
            <dl className="mt-4 space-y-1.5 text-sm">
              <Row label="Reachable" value={ping.reachable ? "yes" : "no"} />
              <Row label="HTTP status" value={ping.status ?? "—"} />
              <Row label="Latency" value={ping.latencyMs != null ? `${n(ping.latencyMs)} ms` : "—"} />
              <Row label="Follows the contract" value={ping.contract ? "yes" : "no"} />
              {ping.model && <Row label="Model name" value={ping.model} />}
              {ping.verdict && <Row label="Sample verdict" value={`${ping.verdict}${ping.hoaxProbability != null ? ` (${pct(ping.hoaxProbability)} hoax)` : ""}`} />}
              {ping.error && <Row label="Problem" value={<span className="text-verdict-hoax">{ping.error}</span>} />}
            </dl>
          )}
        </div>

        {/* Baseline */}
        <div className="neu p-5 lg:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">Baseline classifier</h2>
              <p className="mt-0.5 text-xs text-ink-faint">
                Logistic regression on TF-IDF words and word pairs of the published fact-checks. Also <code className="font-mono">npm run train:baseline</code>.
              </p>
            </div>
            <span className={clsx("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", info ? "bg-verdict-valid/10 text-verdict-valid" : "bg-verdict-warn/10 text-verdict-warn")}>
              {info ? "trained" : "no model file"}
            </span>
          </div>

          {info ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <dl className="space-y-1.5 text-sm">
                <Row label="Trained" value={when(info.trainedAt)} />
                <Row label="Training documents" value={n(info.docs)} />
                <Row label="Holdout documents" value={n(info.holdout)} />
                <Row label="Features kept" value={n(info.features)} />
                <Row label="Text variant" value={info.textVariant} />
                <Row label="Temperature" value={info.temperature} />
                <Row label="Model file" value={mb(info.sizeBytes)} />
              </dl>
              <div className="grid grid-cols-2 gap-3">
                <div className="neu-inset p-4">
                  <div className="text-2xl font-semibold tabular-nums">{pct(info.accuracy)}</div>
                  <div className="text-xs text-ink-muted">accuracy on the holdout</div>
                </div>
                <div className="neu-inset p-4">
                  <div className="text-2xl font-semibold tabular-nums">{pct(info.macroF1)}</div>
                  <div className="text-xs text-ink-muted">macro-F1 on the holdout</div>
                </div>
                <p className="col-span-2 text-xs leading-relaxed text-ink-faint">
                  The holdout is a stratified 10% of the archive the model never saw. The archive holds fact-checks only, so the model knows which claims
                  fact-checkers debunked or confirmed; it does not verify facts, and topics the archive only ever debunked read as hoax-prone.
                </p>
              </div>

              <div className="overflow-x-auto">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Per class</h3>
                <table className="w-full text-left text-xs">
                  <thead className="text-ink-faint">
                    <tr>{["Class", "Precision", "Recall", "F1", "Support"].map((h) => <th key={h} className="pb-1.5 pr-3 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {CLASSES.map((c) => (
                      <tr key={c} className="border-t border-hairline">
                        <td className="py-1.5 pr-3"><Dot verdict={c} /> {VERDICT_META[c].labelEn}</td>
                        <td className="pr-3 tabular-nums">{pct(info.perClass[c].precision)}</td>
                        <td className="pr-3 tabular-nums">{pct(info.perClass[c].recall)}</td>
                        <td className="pr-3 tabular-nums">{pct(info.perClass[c].f1)}</td>
                        <td className="tabular-nums">{n(info.perClass[c].support)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Confusion (rows actual, columns predicted)</h3>
                <table className="w-full text-left text-xs">
                  <thead className="text-ink-faint">
                    <tr>
                      <th className="pb-1.5 pr-3 font-medium" />
                      {CLASSES.map((c) => <th key={c} className="pb-1.5 pr-3 font-medium">{VERDICT_META[c].labelEn}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {info.confusion.map((row, i) => (
                      <tr key={CLASSES[i]} className="border-t border-hairline">
                        <td className="py-1.5 pr-3"><Dot verdict={CLASSES[i]} /> {VERDICT_META[CLASSES[i]].labelEn}</td>
                        {row.map((v, j) => (
                          <td key={j} className={clsx("pr-3 tabular-nums", i === j && "font-semibold")}>{n(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">
              There is no model file yet, so the keyword heuristic answers demo-mode checks. Train one from the published fact-checks; it takes a
              second or two.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button onClick={doTrain} disabled={training} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {training ? <><Spinner /> Training…</> : info ? "Train again" : "Train now"}
            </button>
            <span className="text-xs text-ink-faint">Reads the published articles and replaces the model file. The site picks the new file up on the next check.</span>
          </div>
          {trainError && <p className="mt-3 text-sm text-verdict-hoax">{trainError}</p>}
          {trainedNow && !trainError && <p className="mt-3 text-sm text-verdict-valid">Trained. The figures above are from the new model.</p>}
        </div>
      </div>

      {/* Try it */}
      <div className="neu p-5">
        <h2 className="font-display text-lg font-bold">Try it</h2>
        <p className="mt-0.5 text-xs text-ink-faint">
          The baseline&apos;s own answer, without the archive match that the public detector adds on top. Nothing typed here is logged.
        </p>
        <form onSubmit={doPredict} className="mt-4 space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className={field} placeholder="Paste a claim or a message…" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={predicting || !info || text.trim().length < 3} className="neu-btn px-4 py-2 text-sm disabled:opacity-50">
              {predicting ? <><Spinner /> Classifying…</> : "Classify"}
            </button>
            {!info && <span className="text-xs text-ink-faint">Train a model first.</span>}
          </div>
        </form>
        {predictError && <p className="mt-3 text-sm text-verdict-hoax">{predictError}</p>}
        {prediction && (
          <div className="mt-4 grid gap-4 md:grid-cols-[auto_1fr]">
            <div className="neu-inset min-w-56 p-4">
              <div className="flex items-center gap-2 font-display text-xl font-bold" style={{ color: VERDICT_META[prediction.verdict].color }}>
                <Dot verdict={prediction.verdict} /> {VERDICT_META[prediction.verdict].labelEn}
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                {CLASSES.map((c) => (
                  <div key={c} className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-2 text-xs">
                    <dt className="text-ink-muted">{VERDICT_META[c].labelEn}</dt>
                    <dd className="h-2 overflow-hidden rounded bg-surface-sunken">
                      <div className="h-full rounded" style={{ width: `${prediction.probabilities[c] * 100}%`, background: VERDICT_META[c].color }} />
                    </dd>
                    <dd className="text-right tabular-nums">{pct(prediction.probabilities[c])}</dd>
                  </div>
                ))}
              </dl>
              <dl className="mt-3 space-y-1.5 text-xs">
                <Row label="Hoax probability shown" value={pct(prediction.hoaxProbability)} />
                <Row label="Confidence" value={pct(prediction.confidence)} />
                <Row label="Time" value={`${prediction.ms} ms`} />
              </dl>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Strongest cues</h3>
              <p className="mt-1 text-xs text-ink-faint">Contribution to the hoax-versus-credible log-odds. ▲ pushes toward hoax, ✓ toward credible.</p>
              {prediction.topFeatures.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {prediction.topFeatures.map((f) => (
                    <li
                      key={f.token}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        color: f.kind === "risk" ? "var(--hoax)" : "var(--valid)",
                        background: `color-mix(in srgb, ${f.kind === "risk" ? "var(--hoax)" : "var(--valid)"} 12%, transparent)`,
                      }}
                    >
                      <span className="text-[10px]">{f.kind === "risk" ? "▲" : "✓"}</span>
                      {f.token}
                      <span className="tabular-nums opacity-70">{f.weight > 0 ? "+" : ""}{f.weight.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">No word in this text carries weight on its own.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

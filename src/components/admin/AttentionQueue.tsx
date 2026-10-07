"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { VerdictBadge } from "@/components/article/ArticleCard";
import type { AttentionCheck, AttentionDays, AttentionGroup, AttentionList, AttentionTab, Disagreement } from "@/lib/attention";
import { clsx } from "@/lib/clsx";
import { VERDICT_META } from "@/lib/verdict";

const LANG_NAME: Record<string, string> = { id: "Indonesian", en: "English", ms: "Malay" };
const ENGINE_NAME: Record<string, string> = { external: "external model", baseline: "trained classifier", heuristic: "keyword heuristic" };
/** Texts longer than this start folded. */
const FOLD_CHARS = 420;

const pct = (n: number) => `${Math.round(n * 100)}%`;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
const prefill = (path: string, text: string) => `${path}?text=${encodeURIComponent(text)}`;

interface Props {
  days: AttentionDays;
  tab: AttentionTab;
  unmatched: AttentionList;
  disagreements: Disagreement[];
  lowConfidence: AttentionCheck[];
}

export function AttentionQueue({ days, tab: initialTab, unmatched, disagreements, lowConfidence }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<AttentionTab>(initialTab);
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [undo, setUndo] = useState<AttentionGroup | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = unmatched.groups.filter((g) => !removed.has(g.key));
  const tabs: { key: AttentionTab; label: string; count: number }[] = [
    { key: "unmatched", label: "Unmatched claims", count: unmatched.total - removed.size },
    { key: "disagreements", label: "Disagreements", count: disagreements.length },
    { key: "low", label: "Low confidence", count: lowConfidence.length },
  ];

  function switchTab(next: AttentionTab) {
    setTab(next);
    window.history.replaceState(null, "", `/admin/attention?days=${days}&tab=${next}`);
  }

  async function send(method: "POST" | "DELETE", key: string): Promise<void> {
    const res = await fetch("/api/admin/attention/dismiss", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error ?? "The request failed.");
    }
  }

  async function dismiss(g: AttentionGroup) {
    setBusy(g.key);
    setError(null);
    try {
      await send("POST", g.key);
      setRemoved((s) => new Set(s).add(g.key));
      setUndo(g);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not dismiss the group.");
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    if (!undo) return;
    const g = undo;
    setBusy(g.key);
    setError(null);
    try {
      await send("DELETE", g.key);
      setRemoved((s) => {
        const next = new Set(s);
        next.delete(g.key);
        return next;
      });
      setUndo(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore the group.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="neu flex flex-wrap items-center gap-1 p-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => switchTab(t.key)}
            className={clsx(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t.key ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            {t.label} <span className={clsx("tabular-nums", tab === t.key ? "opacity-70" : "text-ink-faint")}>{t.count.toLocaleString("en-US")}</span>
          </button>
        ))}
        <span className="ml-auto px-2 text-xs text-ink-faint">
          {unmatched.scanned.toLocaleString("en-US")} public checks scanned
          {unmatched.dismissed + removed.size > 0 && `, ${(unmatched.dismissed + removed.size).toLocaleString("en-US")} dismissed`}
        </span>
      </div>

      {error && <p className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">{error}</p>}
      {undo && (
        <p className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-surface-sunken px-4 py-2.5 text-sm text-ink-muted">
          <span className="min-w-0 flex-1 truncate">Dismissed “{undo.isLink ? undo.url : undo.text.slice(0, 80)}”.</span>
          <button type="button" onClick={() => void restore()} disabled={busy === undo.key} className="font-medium text-brand hover:underline disabled:opacity-50">
            Undo
          </button>
        </p>
      )}

      {tab === "unmatched" && (
        <>
          <p className="text-xs text-ink-faint">
            Checks with no archive match, grouped when the texts share most of their words. Texts are shown as people typed them; no network
            or device details appear here.
          </p>
          {groups.length === 0 ? (
            <Empty>Every public check in the last {days} days found a fact-check in the archive, or was dismissed.</Empty>
          ) : (
            <ul className="space-y-3">
              {groups.map((g) => (
                <GroupCard key={g.key} group={g} busy={busy === g.key} onDismiss={() => void dismiss(g)} />
              ))}
            </ul>
          )}
          {unmatched.total > unmatched.groups.length && (
            <p className="text-xs text-ink-faint">Showing the {unmatched.groups.length} most checked of {unmatched.total.toLocaleString("en-US")} groups.</p>
          )}
        </>
      )}

      {tab === "disagreements" && (
        <>
          <p className="text-xs text-ink-faint">
            The archive match answered these checks, yet the engine&apos;s own probability pointed the other way. Either the match is wrong
            or the engine is; open the match to decide.
          </p>
          {disagreements.length === 0 ? (
            <Empty>No check in the last {days} days has a match that contradicts the engine.</Empty>
          ) : (
            <ul className="space-y-3">
              {disagreements.map((d) => (
                <DisagreementCard key={d.id} item={d} />
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "low" && (
        <>
          <p className="text-xs text-ink-faint">Unmatched checks with a hoax probability between 40% and 60%: the engine could not decide and the archive had nothing.</p>
          {lowConfidence.length === 0 ? (
            <Empty>No unsure, unmatched check in the last {days} days.</Empty>
          ) : (
            <ul className="space-y-3">
              {lowConfidence.map((c) => (
                <CheckCard key={c.id} item={c} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- cards */

function GroupCard({ group: g, busy, onDismiss }: { group: AttentionGroup; busy: boolean; onDismiss: () => void }) {
  const input = g.isLink ? g.url : g.text;
  return (
    <li className="neu p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-ink px-2.5 py-0.5 font-semibold tabular-nums text-surface-raised">
            {g.count}× checked
          </span>
          {g.verdict && <VerdictDot verdict={g.verdict} />}
          <span className="text-ink-muted">{pct(g.probability)} hoax probability</span>
          <Chip>{g.isLink ? "link" : "text"}</Chip>
          {g.langs.map((l) => (
            <Chip key={l}>{LANG_NAME[l] ?? l}</Chip>
          ))}
          {g.engines.length > 0 && <span className="text-ink-faint">{g.engines.map((e) => ENGINE_NAME[e] ?? e).join(", ")}</span>}
        </div>
        <span className="text-xs text-ink-faint" suppressHydrationWarning>
          {g.count > 1 ? `${when(g.firstSeen)} – ${when(g.lastSeen)}` : when(g.lastSeen)} WIB
        </span>
      </div>

      {g.isLink ? (
        <div className="mt-3 min-w-0">
          <a href={g.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-mono text-xs text-ink hover:text-brand">
            {g.url} ↗
          </a>
          <p className="mt-1 text-sm font-medium">{g.pageTitle || <span className="text-ink-faint">The page gave no title.</span>}</p>
        </div>
      ) : (
        <Text text={g.text} chars={g.chars} />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
        <Link href={prefill("/admin/extract", input)} className="btn-primary px-4 py-2 text-xs">
          Create draft
        </Link>
        <Link href={prefill("/admin/detect", input)} className="neu-btn px-3.5 py-2 text-xs">
          Open in detection lab
        </Link>
        <button type="button" onClick={onDismiss} disabled={busy} className="ml-auto px-3 py-2 text-xs text-ink-muted hover:text-ink disabled:opacity-50">
          {busy ? "…" : "Dismiss"}
        </button>
      </div>
    </li>
  );
}

function DisagreementCard({ item: d }: { item: Disagreement }) {
  const band = VERDICT_META[d.band];
  return (
    <li className="neu p-5">
      <Meta item={d} />
      <Text text={d.isLink ? d.pageTitle || d.url : d.text} chars={d.text.length} />
      {d.isLink && (
        <a href={d.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block break-all font-mono text-xs text-ink-faint hover:text-brand">
          {d.url} ↗
        </a>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="neu-inset p-3">
          <div className="eyebrow">Engine alone</div>
          <div className="mt-1.5 flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: band.color }} aria-hidden />
            <span className="font-medium">{band.labelEn}</span>
            <span className="text-ink-muted">· {pct(d.probability)} hoax probability</span>
          </div>
        </div>
        <div className="neu-inset p-3">
          <div className="eyebrow">Archive match answered</div>
          <div className="mt-1.5 flex items-start gap-2 text-sm">
            <VerdictBadge verdict={d.match.verdict} className="mt-0.5 shrink-0" />
            <span className="min-w-0">
              <Link href={`/admin/articles/${d.match.slug}/edit`} className="block font-medium leading-snug hover:text-brand">
                {d.match.title}
              </Link>
              <span className="text-xs text-ink-faint">
                {d.match.published ? "published" : "hidden"} ·{" "}
                <Link href={`/blog/${d.match.slug}`} target="_blank" className="hover:text-ink">
                  open on the site ↗
                </Link>
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
        <Link href={`/admin/articles/${d.match.slug}/edit`} className="btn-primary px-4 py-2 text-xs">
          Edit the match
        </Link>
        <Link href={prefill("/admin/detect", d.isLink ? d.url : d.text)} className="neu-btn px-3.5 py-2 text-xs">
          Open in detection lab
        </Link>
      </div>
    </li>
  );
}

function CheckCard({ item: c }: { item: AttentionCheck }) {
  const input = c.isLink ? c.url : c.text;
  return (
    <li className="neu p-5">
      <Meta item={c} />
      {c.isLink ? (
        <div className="mt-3 min-w-0">
          <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-mono text-xs text-ink hover:text-brand">
            {c.url} ↗
          </a>
          {c.pageTitle && <p className="mt-1 text-sm font-medium">{c.pageTitle}</p>}
        </div>
      ) : (
        <Text text={c.text} chars={c.text.length} />
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
        <Link href={prefill("/admin/extract", input)} className="btn-primary px-4 py-2 text-xs">
          Create draft
        </Link>
        <Link href={prefill("/admin/detect", input)} className="neu-btn px-3.5 py-2 text-xs">
          Open in detection lab
        </Link>
      </div>
    </li>
  );
}

/* ---------------------------------------------------------------- pieces */

function Meta({ item }: { item: AttentionCheck }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        {item.verdict && <VerdictDot verdict={item.verdict} />}
        <span className="text-ink-muted">{pct(item.probability)} hoax probability</span>
        <Chip>{item.isLink ? "link" : "text"}</Chip>
        {item.lang && <Chip>{LANG_NAME[item.lang] ?? item.lang}</Chip>}
        {item.engine && <span className="text-ink-faint">{ENGINE_NAME[item.engine] ?? item.engine}</span>}
      </div>
      <span className="text-ink-faint" suppressHydrationWarning>
        {when(item.at)} WIB
      </span>
    </div>
  );
}

function Text({ text, chars }: { text: string; chars: number }) {
  const [open, setOpen] = useState(false);
  const long = chars > FOLD_CHARS;
  return (
    <div className="mt-3">
      <p className={clsx("whitespace-pre-wrap break-words text-sm leading-relaxed", long && !open && "line-clamp-4")}>{text || <span className="text-ink-faint">Empty.</span>}</p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-xs text-brand hover:underline">
          {open ? "Show less" : `Show all (${chars.toLocaleString("en-US")} characters)`}
        </button>
      )}
    </div>
  );
}

function VerdictDot({ verdict }: { verdict: keyof typeof VERDICT_META }) {
  const m = VERDICT_META[verdict];
  return (
    <span className="flex items-center gap-1.5 font-medium">
      <span className="h-2 w-2 rounded-full" style={{ background: m.color }} aria-hidden />
      {m.labelEn}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-hairline px-2 py-0.5 text-ink-muted">{children}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="neu p-10 text-center text-sm text-ink-muted">{children}</div>;
}

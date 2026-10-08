"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { VerdictBadge } from "@/components/article/ArticleCard";
import type { AttentionCheck, AttentionDays, AttentionGroup, AttentionList, AttentionTab, Disagreement } from "@/lib/attention";
import { formatAdminDateTime, formatAdminNumber, tk } from "@/lib/admin-lang";
import { clsx } from "@/lib/clsx";
import { VERDICT_META } from "@/lib/verdict";
import { useAdminT } from "./AdminLang";

const LANG_NAME: Record<string, string> = { id: tk("Indonesian"), en: tk("English"), ms: tk("Malay") };
const ENGINE_NAME: Record<string, string> = { external: tk("AI model"), baseline: tk("trained model"), heuristic: tk("keyword rules") };
/** Texts longer than this start folded. */
const FOLD_CHARS = 420;

const pct = (n: number) => `${Math.round(n * 100)}%`;
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
  const { t, lang } = useAdminT();
  const [tab, setTab] = useState<AttentionTab>(initialTab);
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [undo, setUndo] = useState<AttentionGroup | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = unmatched.groups.filter((g) => !removed.has(g.key));
  const tabs: { key: AttentionTab; label: string; count: number }[] = [
    { key: "unmatched", label: t("Not in the archive"), count: unmatched.total - removed.size },
    { key: "disagreements", label: t("Possibly wrong match"), count: disagreements.length },
    { key: "low", label: t("Detector unsure"), count: lowConfidence.length },
  ];
  const dismissed = unmatched.dismissed + removed.size;

  function switchTab(next: AttentionTab) {
    setTab(next);
    window.history.replaceState(null, "", `/admin/attention?days=${days}&tab=${next}`);
  }

  async function send(method: "POST" | "DELETE", key: string): Promise<void> {
    const res = await fetch("/api/admin/attention/dismiss", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error ?? t("The action did not work."));
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
      setError(err instanceof Error ? err.message : t("Could not ignore this group."));
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
      setError(err instanceof Error ? err.message : t("Could not bring this group back."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="neu flex flex-wrap items-center gap-1 p-2" role="tablist">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => switchTab(tb.key)}
            className={clsx(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === tb.key ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            {tb.label} <span className={clsx("tabular-nums", tab === tb.key ? "opacity-70" : "text-ink-faint")}>{formatAdminNumber(tb.count, lang)}</span>
          </button>
        ))}
        <span className="ml-auto px-2 text-xs text-ink-faint">
          {dismissed > 0
            ? t("{n} checks looked at, {m} ignored", { n: unmatched.scanned, m: dismissed })
            : t("{n} checks looked at", { n: unmatched.scanned })}
        </span>
      </div>

      {error && <p className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">{error}</p>}
      {undo && (
        <p className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-surface-sunken px-4 py-2.5 text-sm text-ink-muted">
          <span className="min-w-0 flex-1 truncate">{t("Ignored “{text}”.", { text: undo.isLink ? undo.url : undo.text.slice(0, 80) })}</span>
          <button type="button" onClick={() => void restore()} disabled={busy === undo.key} className="px-2 py-1 font-medium text-brand hover:underline disabled:opacity-50">
            {t("Undo")}
          </button>
        </p>
      )}

      {tab === "unmatched" && (
        <>
          <p className="text-sm text-ink-muted">
            {t("People checked these, but the archive had no fact-check about them. Similar texts are grouped together. Shown as people typed them, without any network or device details.")}
          </p>
          {groups.length === 0 ? (
            <Empty>{t("Every check in the last {days} days found a fact-check, or was ignored.", { days })}</Empty>
          ) : (
            <ul className="space-y-3">
              {groups.map((g) => (
                <GroupCard key={g.key} group={g} busy={busy === g.key} onDismiss={() => void dismiss(g)} />
              ))}
            </ul>
          )}
          {unmatched.total > unmatched.groups.length && (
            <p className="text-xs text-ink-faint">{t("Showing the {shown} most checked of {total} groups.", { shown: unmatched.groups.length, total: unmatched.total })}</p>
          )}
        </>
      )}

      {tab === "disagreements" && (
        <>
          <p className="text-sm text-ink-muted">
            {t("The archive answered these checks, but the detector on its own thought the opposite. One of the two is wrong; open the article to decide.")}
          </p>
          {disagreements.length === 0 ? (
            <Empty>{t("No check in the last {days} days where the archive and the detector disagree.", { days })}</Empty>
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
          <p className="text-sm text-ink-muted">{t("Checks the archive had nothing for, where the detector could not decide (a 40% to 60% chance of hoax).")}</p>
          {lowConfidence.length === 0 ? (
            <Empty>{t("No unsure checks in the last {days} days.", { days })}</Empty>
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
  const { t, lang } = useAdminT();
  const input = g.isLink ? g.url : g.text;
  const when = (iso: string) => formatAdminDateTime(iso, lang);
  return (
    <li className="neu p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-ink px-2.5 py-0.5 font-semibold tabular-nums text-surface-raised">{t("Checked {n}×", { n: g.count })}</span>
          {g.verdict && <VerdictDot verdict={g.verdict} />}
          <span className="text-ink-muted">{t("{pct} chance of hoax", { pct: pct(g.probability) })}</span>
          <Chip>{g.isLink ? t("Link") : t("Text")}</Chip>
          {g.langs.map((l) => (
            <Chip key={l}>{LANG_NAME[l] ? t(LANG_NAME[l]) : l}</Chip>
          ))}
          {g.engines.length > 0 && <span className="text-ink-faint">{g.engines.map((e) => (ENGINE_NAME[e] ? t(ENGINE_NAME[e]) : e)).join(", ")}</span>}
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
          <p className="mt-1 text-sm font-medium">{g.pageTitle || <span className="text-ink-faint">{t("The page has no title.")}</span>}</p>
        </div>
      ) : (
        <Text text={g.text} chars={g.chars} />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
        <Link href={prefill("/admin/extract", input)} className="btn-primary px-4 py-2 text-sm">
          {t("Start a draft")}
        </Link>
        <Link href={prefill("/admin/detect", input)} className="neu-btn px-3.5 py-2 text-sm">
          {t("Open in detection lab")}
        </Link>
        <button type="button" onClick={onDismiss} disabled={busy} className="ml-auto px-3 py-2 text-sm text-ink-muted hover:text-ink disabled:opacity-50">
          {busy ? "…" : t("Ignore")}
        </button>
      </div>
    </li>
  );
}

function DisagreementCard({ item: d }: { item: Disagreement }) {
  const { t } = useAdminT();
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
          <div className="eyebrow">{t("The detector on its own said")}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: band.color }} aria-hidden />
            <span className="font-medium">{t(band.label)}</span>
            <span className="text-ink-muted">· {t("{pct} chance of hoax", { pct: pct(d.probability) })}</span>
          </div>
        </div>
        <div className="neu-inset p-3">
          <div className="eyebrow">{t("The archive answered with")}</div>
          <div className="mt-1.5 flex items-start gap-2 text-sm">
            <VerdictBadge verdict={d.match.verdict} className="mt-0.5 shrink-0" />
            <span className="min-w-0">
              <Link href={`/admin/articles/${d.match.slug}/edit`} className="block font-medium leading-snug hover:text-brand">
                {d.match.title}
              </Link>
              <span className="text-xs text-ink-faint">
                {d.match.published ? t("Published") : t("Hidden")} ·{" "}
                <Link href={`/blog/${d.match.slug}`} target="_blank" className="hover:text-ink">
                  {t("View on site ↗")}
                </Link>
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
        <Link href={`/admin/articles/${d.match.slug}/edit`} className="btn-primary px-4 py-2 text-sm">
          {t("Edit that article")}
        </Link>
        <Link href={prefill("/admin/detect", d.isLink ? d.url : d.text)} className="neu-btn px-3.5 py-2 text-sm">
          {t("Open in detection lab")}
        </Link>
      </div>
    </li>
  );
}

function CheckCard({ item: c }: { item: AttentionCheck }) {
  const { t } = useAdminT();
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
        <Link href={prefill("/admin/extract", input)} className="btn-primary px-4 py-2 text-sm">
          {t("Start a draft")}
        </Link>
        <Link href={prefill("/admin/detect", input)} className="neu-btn px-3.5 py-2 text-sm">
          {t("Open in detection lab")}
        </Link>
      </div>
    </li>
  );
}

/* ---------------------------------------------------------------- pieces */

function Meta({ item }: { item: AttentionCheck }) {
  const { t, lang } = useAdminT();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {item.verdict && <VerdictDot verdict={item.verdict} />}
        <span className="text-ink-muted">{t("{pct} chance of hoax", { pct: pct(item.probability) })}</span>
        <Chip>{item.isLink ? t("Link") : t("Text")}</Chip>
        {item.lang && <Chip>{LANG_NAME[item.lang] ? t(LANG_NAME[item.lang]) : item.lang}</Chip>}
        {item.engine && <span className="text-ink-faint">{ENGINE_NAME[item.engine] ? t(ENGINE_NAME[item.engine]) : item.engine}</span>}
      </div>
      <span className="text-xs text-ink-faint" suppressHydrationWarning>
        {formatAdminDateTime(item.at, lang)} WIB
      </span>
    </div>
  );
}

function Text({ text, chars }: { text: string; chars: number }) {
  const { t } = useAdminT();
  const [open, setOpen] = useState(false);
  const long = chars > FOLD_CHARS;
  return (
    <div className="mt-3">
      <p className={clsx("whitespace-pre-wrap break-words text-sm leading-relaxed", long && !open && "line-clamp-4")}>{text || <span className="text-ink-faint">{t("Empty.")}</span>}</p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 py-1 text-sm text-brand hover:underline">
          {open ? t("Show less") : t("Show all ({n} characters)", { n: chars })}
        </button>
      )}
    </div>
  );
}

function VerdictDot({ verdict }: { verdict: keyof typeof VERDICT_META }) {
  const { t } = useAdminT();
  const m = VERDICT_META[verdict];
  return (
    <span className="flex items-center gap-1.5 font-medium">
      <span className="h-2 w-2 rounded-full" style={{ background: m.color }} aria-hidden />
      {t(m.label)}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-hairline px-2 py-0.5 text-xs text-ink-muted">{children}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="neu p-10 text-center text-sm text-ink-muted">{children}</div>;
}

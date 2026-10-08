"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HtmlTagRow } from "@/lib/settings";
import { clsx } from "@/lib/clsx";
import { DataGrid, type GridColumn } from "@/components/admin/DataGrid";
import { useAdminT } from "@/components/admin/AdminLang";

const field = "h-8 rounded-md border border-hairline bg-surface-raised px-2 font-mono text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";
const pill = "whitespace-nowrap rounded-full border border-hairline px-3 py-1 text-sm font-medium hover:border-ink disabled:opacity-50";

/** How a stored tag is matched: entity names get their "&", anything else is replaced as it is. */
const shown = (tag: string) => (/^#?[a-z0-9]+;?$/i.test(tag) ? `&${tag}` : tag);

/** The entity → replacement table on the panel grid, with inline edit, add and delete. */
export function SettingsHtmlTags({ tags: initial }: { tags: HtmlTagRow[] }) {
  const router = useRouter();
  const { t } = useAdminT();
  const [tags, setTags] = useState(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ tag: "", alt: "" });
  const [fresh, setFresh] = useState({ tag: "", alt: "" });
  const [busy, setBusy] = useState(false);

  async function send(url: string, method: string, body: { tag: string; alt: string }) {
    setBusy(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json()) as { tags?: HtmlTagRow[]; error?: string };
      if (!res.ok || !data.tags) throw new Error(data.error);
      setTags(data.tags);
      router.refresh();
      return true;
    } catch (err) {
      alert(err instanceof Error && err.message ? err.message : t("Could not save. Please try again."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(id: number) {
    if (!draft.tag.trim()) return alert(t("Please enter the code."));
    if (await send(`/api/admin/settings/html-tags/${id}`, "PUT", draft)) setEditing(null);
  }

  async function add() {
    if (!fresh.tag.trim()) return alert(t("Please enter the code."));
    if (await send("/api/admin/settings/html-tags", "POST", fresh)) setFresh({ tag: "", alt: "" });
  }

  async function remove(row: HtmlTagRow) {
    if (!confirm(t("Delete the replacement for {tag}?", { tag: row.tag }))) return;
    setTags((list) => list.filter((x) => x.id !== row.id));
    const res = await fetch(`/api/admin/settings/html-tags/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      setTags((list) => [...list, row].sort((a, b) => a.id - b.id));
      alert(t("Could not delete it. Please try again."));
      return;
    }
    router.refresh();
  }

  const columns: GridColumn<HtmlTagRow>[] = [
    {
      key: "tag",
      header: t("Code (as stored)"),
      render: (row) =>
        editing === row.id ? (
          <input
            value={draft.tag}
            onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && save(row.id)}
            className={field}
            aria-label={t("Code")}
            autoFocus
          />
        ) : (
          <span className="font-mono text-sm">{row.tag}</span>
        ),
    },
    {
      key: "matches",
      header: t("Looks for"),
      render: (row) => <span className="font-mono text-sm text-ink-faint">{shown(editing === row.id ? draft.tag : row.tag)}</span>,
    },
    {
      key: "alt",
      header: t("Replaced with"),
      render: (row) =>
        editing === row.id ? (
          <input
            value={draft.alt}
            onChange={(e) => setDraft({ ...draft, alt: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && save(row.id)}
            className={field}
            aria-label={t("Replaced with")}
          />
        ) : (
          <span className="font-mono text-sm">{row.alt === "" ? <span className="text-ink-faint">{t("(removed)")}</span> : JSON.stringify(row.alt)}</span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("Actions")}</span>,
      width: "160px",
      align: "right",
      render: (row) =>
        editing === row.id ? (
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => save(row.id)} disabled={busy} className="btn-primary px-3 py-1 text-sm disabled:opacity-50">
              {t("Save")}
            </button>
            <button type="button" onClick={() => setEditing(null)} className={pill}>
              {t("Cancel")}
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setEditing(row.id);
                setDraft({ tag: row.tag, alt: row.alt });
              }}
              className={pill}
            >
              {t("Edit")}
            </button>
            <button type="button" onClick={() => remove(row)} className={clsx(pill, "text-verdict-hoax hover:bg-verdict-hoax/10")}>
              {t("Delete")}
            </button>
          </div>
        ),
    },
  ];

  return (
    <DataGrid
      caption={t("{n} replacements", { n: tags.length })}
      columns={columns}
      rows={tags}
      rowKey={(row) => String(row.id)}
      toolbar={
        <form
          className="flex flex-wrap items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input value={fresh.tag} onChange={(e) => setFresh({ ...fresh, tag: e.target.value })} placeholder={t("Code, e.g. #8216;")} className={clsx(field, "w-40")} aria-label={t("New code")} />
          <input value={fresh.alt} onChange={(e) => setFresh({ ...fresh, alt: e.target.value })} placeholder={t("Replaced with")} className={clsx(field, "w-36")} aria-label={t("New replacement")} />
          <button type="submit" disabled={busy || !fresh.tag.trim()} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">
            + {t("Add")}
          </button>
        </form>
      }
      emptyMessage={t("No replacements yet.")}
      dense
    />
  );
}

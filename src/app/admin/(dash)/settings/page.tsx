import Link from "next/link";
import { countStopwords, isSettingLang, listHtmlTags, listSkipDomains, listStopwords, SETTING_LANGS, type SettingLang } from "@/lib/settings";
import { SettingsStopwords } from "@/components/admin/SettingsStopwords";
import { SettingsHtmlTags } from "@/components/admin/SettingsHtmlTags";
import { SettingsSkipDomains } from "@/components/admin/SettingsSkipDomains";
import { Pagination } from "@/components/ui/Pagination";
import { formatCount } from "@/lib/sources";
import { clsx } from "@/lib/clsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const lang: SettingLang = isSettingLang(one(sp.lang)) ? (one(sp.lang) as SettingLang) : "id";
  const q = one(sp.q).trim();
  const page = Number(one(sp.page)) || 1;
  const words = listStopwords(lang, q, page, 120);
  const counts = countStopwords();
  const tags = listHtmlTags();
  const domains = listSkipDomains();

  const href = (changes: { lang?: string; q?: string; page?: number }) => {
    const p = new URLSearchParams();
    const l = changes.lang ?? lang;
    if (l !== "id") p.set("lang", l);
    const nq = changes.q ?? q;
    if (nq) p.set("q", nq);
    if (changes.page && changes.page > 1) p.set("page", String(changes.page));
    const s = p.toString();
    return s ? `/admin/settings?${s}` : "/admin/settings";
  };
  const first = words.total ? (words.page - 1) * 120 + 1 : 0;
  const last = Math.min(words.page * 120, words.total);

  return (
    <div className="space-y-4">
      <div className="neu p-6">
        <span className="eyebrow">Settings</span>
        <h1 className="mt-2 font-display text-2xl font-bold">Detector settings</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          The lists the old panel kept under HOAX SETTING: stopwords per language, HTML entity replacements and domains whose pages are
          never read. Changes apply at once.
        </p>
      </div>

      <section className="neu p-6" id="stopwords">
        <h2 className="font-display text-lg font-bold">Languages &amp; stopwords</h2>
        <p className="mt-1 text-sm text-ink-muted">Used by the detection lab&apos;s similarity algorithms.</p>
        <div className="mt-4 flex flex-wrap items-center gap-1">
          {SETTING_LANGS.map((l) => (
            <Link
              key={l.code}
              href={href({ lang: l.code, q: "", page: 1 })}
              className={clsx(
                "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                lang === l.code ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              {l.name} <span className="opacity-70">({formatCount(counts[l.code])})</span>
            </Link>
          ))}
        </div>
        <form action="/admin/settings" method="get" className="mt-4 flex flex-wrap items-center gap-2">
          {lang !== "id" && <input type="hidden" name="lang" value={lang} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Find a word…"
            className="min-w-48 flex-1 rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30"
          />
          <button type="submit" className="neu-btn px-4 py-2 text-sm">Search</button>
          <span className="text-xs text-ink-muted">View {formatCount(first)}–{formatCount(last)} of {formatCount(words.total)}</span>
        </form>
        <SettingsStopwords key={`${lang}-${q}-${words.page}`} lang={lang} items={words.items} />
        <Pagination page={words.page} pages={words.pages} hrefFor={(p) => href({ page: p })} />
      </section>

      <section className="neu p-6" id="html-tags">
        <h2 className="font-display text-lg font-bold">HTML tags</h2>
        <p className="mt-1 text-sm text-ink-muted">Applied when text is extracted from a page.</p>
        <SettingsHtmlTags tags={tags} />
      </section>

      <section className="neu p-6" id="skip-domains">
        <h2 className="font-display text-lg font-bold">Skip domains</h2>
        <p className="mt-1 text-sm text-ink-muted">The detector and the extract tool refuse links on these domains.</p>
        <SettingsSkipDomains domains={domains} />
      </section>
    </div>
  );
}

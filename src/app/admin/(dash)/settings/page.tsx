import { countStopwords, listHtmlTags, listSkipDomains, listStopwords, SETTING_LANGS, stopwordFilterFrom } from "@/lib/settings";
import { SettingsStopwords } from "@/components/admin/SettingsStopwords";
import { SettingsHtmlTags } from "@/components/admin/SettingsHtmlTags";
import { SettingsSkipDomains } from "@/components/admin/SettingsSkipDomains";
import { AdminPageHeader, AdminTab } from "@/components/admin/AdminPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const f = stopwordFilterFrom((k) => one(sp[k]) || undefined);
  const words = listStopwords(f.lang, f.q, f.page, f.pageSize, { origin: f.origin, sort: f.sort, order: f.order });
  const counts = countStopwords();
  const tags = listHtmlTags();
  const domains = listSkipDomains();
  const totalWords = counts.en + counts.id + counts.ms;

  return (
    <div>
      <AdminPageHeader
        title="Detector settings"
        count={totalWords + tags.length + domains.length}
        description="The lists the old panel kept under HOAX SETTING: stopwords per language, HTML entity replacements and domains whose pages are never read. Changes apply at once."
      />

      <div className="space-y-8">
        <section id="stopwords" className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-bold">Languages &amp; stopwords</h2>
            <p className="text-sm text-ink-muted">Used by the detection lab&apos;s similarity algorithms.</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {SETTING_LANGS.map((l) => (
              <AdminTab key={l.code} href={l.code === "id" ? "/admin/settings#stopwords" : `/admin/settings?lang=${l.code}#stopwords`} active={f.lang === l.code} count={counts[l.code]}>
                {l.name}
              </AdminTab>
            ))}
          </div>
          <SettingsStopwords
            lang={f.lang}
            langName={SETTING_LANGS.find((l) => l.code === f.lang)?.name ?? f.lang}
            items={words.items}
            paging={{ page: words.page, pages: words.pages, total: words.total, pageSize: words.pageSize }}
            sort={{ key: f.sort ?? "word", order: f.order ?? "asc" }}
          />
        </section>

        <section id="html-tags" className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-bold">HTML tags</h2>
            <p className="text-sm text-ink-muted">Replacements applied when text is extracted from a page.</p>
          </div>
          <SettingsHtmlTags tags={tags} />
        </section>

        <section id="skip-domains" className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-bold">Skip domains</h2>
            <p className="text-sm text-ink-muted">The detector and the extract tool refuse links on these domains.</p>
          </div>
          <SettingsSkipDomains domains={domains} />
        </section>
      </div>
    </div>
  );
}

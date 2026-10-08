import { countStopwords, listHtmlTags, listSkipDomains, listStopwords, SETTING_LANGS, stopwordFilterFrom } from "@/lib/settings";
import { SettingsStopwords } from "@/components/admin/SettingsStopwords";
import { SettingsHtmlTags } from "@/components/admin/SettingsHtmlTags";
import { SettingsSkipDomains } from "@/components/admin/SettingsSkipDomains";
import { AdminPageHeader, AdminTab } from "@/components/admin/AdminPage";
import { requireAdmin } from "@/lib/require-admin";
import { getAdminT } from "@/lib/admin-lang-server";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminT();
  return { title: t("Settings") };
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const { t } = await getAdminT();
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
        title={t("Detector settings")}
        count={totalWords + tags.length + domains.length}
        description={t(
          "Word lists the detector uses: common words to skip in each language, HTML codes to clean up when text is read from a page, and websites whose links are never read. Changes apply at once.",
        )}
      />

      <div className="space-y-8">
        <section id="stopwords" className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-bold">{t("Common words to skip (stopwords)")}</h2>
            <p className="text-sm text-ink-muted">
              {t("Small words such as “yang” or “the” that say little about a text. The detection lab ignores them when it compares texts.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {SETTING_LANGS.map((l) => (
              <AdminTab key={l.code} href={l.code === "id" ? "/admin/settings#stopwords" : `/admin/settings?lang=${l.code}#stopwords`} active={f.lang === l.code} count={counts[l.code]}>
                {t(l.name)}
              </AdminTab>
            ))}
          </div>
          <SettingsStopwords
            lang={f.lang}
            langName={t(SETTING_LANGS.find((l) => l.code === f.lang)?.name ?? f.lang)}
            items={words.items}
            paging={{ page: words.page, pages: words.pages, total: words.total, pageSize: words.pageSize }}
            sort={{ key: f.sort ?? "word", order: f.order ?? "asc" }}
          />
        </section>

        <section id="html-tags" className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-bold">{t("HTML codes")}</h2>
            <p className="text-sm text-ink-muted">{t("When text is read from a web page, these codes are replaced with ordinary characters.")}</p>
          </div>
          <SettingsHtmlTags tags={tags} />
        </section>

        <section id="skip-domains" className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-bold">{t("Skipped domains")}</h2>
            <p className="text-sm text-ink-muted">{t("Links to these websites are never read by the detector or the extract tool.")}</p>
          </div>
          <SettingsSkipDomains domains={domains} />
        </section>
      </div>
    </div>
  );
}

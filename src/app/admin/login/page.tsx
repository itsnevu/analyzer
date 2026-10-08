import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";
import { AdminLangSwitch } from "@/components/admin/AdminLang";
import { LogoMark } from "@/components/ui/Logo";
import { authConfigProblem, usingDevDefaults } from "@/lib/auth";
import { getArticleStats } from "@/lib/articles";
import { getReportCounts } from "@/lib/reports";
import { usageTotals } from "@/lib/usage";
import { formatAdminNumber, tk } from "@/lib/admin-lang";
import { getAdminT } from "@/lib/admin-lang-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminT();
  return { title: t("Admin sign in"), robots: { index: false, follow: false } };
}

interface Figure {
  label: string;
  value: number | null;
}

function weekAgo(): string {
  return new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
}

/** The three numbers on the dark panel; each one fails on its own and shows a dash. */
async function loadFigures(): Promise<Figure[]> {
  const safe = async (read: () => number | Promise<number>): Promise<number | null> => {
    try {
      const n = Number(await read());
      return Number.isFinite(n) ? n : null;
    } catch (err) {
      console.error("[admin] login figure failed:", err);
      return null;
    }
  };
  const [articles, checks, reports] = await Promise.all([
    safe(async () => (await getArticleStats()).total),
    safe(() => Number(usageTotals({ from: weekAgo() }).checks ?? 0)),
    safe(async () => {
      const c = await getReportCounts();
      return c.byStatus.new + c.byStatus["in-progress"];
    }),
  ]);
  return [
    { label: tk("Published articles"), value: articles },
    { label: tk("Checks in the last 7 days"), value: checks },
    { label: tk("Open reports"), value: reports },
  ];
}

export default async function AdminLoginPage() {
  const { t, lang } = await getAdminT();
  const problem = authConfigProblem();
  const notice = problem
    ? t("Admin sign-in is turned off on this server. {problem} Run `npm run setup` on the server, then restart it.", { problem })
    : usingDevDefaults()
      ? t("Development mode with the default password from README.md. Set ADMIN_PASSWORD and AUTH_SECRET (npm run setup) before the site goes online.")
      : undefined;
  const figures = await loadFigures();

  return (
    <div className="relative grid min-h-screen bg-surface lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <AdminLangSwitch className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6" />
      {/* Brand panel: the admin rail's colours in both themes. */}
      <aside className="relative overflow-hidden bg-[var(--sidebar-bg)] px-6 py-8 text-[var(--sidebar-ink)] sm:px-10 lg:flex lg:flex-col lg:justify-between lg:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage: "linear-gradient(var(--sidebar-line) 1px, transparent 1px), linear-gradient(90deg, var(--sidebar-line) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at 20% 10%, black, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at 20% 10%, black, transparent 75%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <LogoMark className="h-10 w-10 shrink-0" />
          <span className="leading-tight">
            <span className="block font-display text-base font-bold">Hoax Analyzer</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--sidebar-muted)]">{t("Admin")}</span>
          </span>
        </div>

        <div className="relative mt-8 lg:mt-0">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-balance sm:text-4xl lg:text-5xl">{t("Hoax Analyzer control panel")}</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--sidebar-muted)]">
            {t("The fact-check archive, the detector and what visitors send in, in one place.")}
          </p>
        </div>

        <dl className="relative mt-8 grid grid-cols-3 gap-3 lg:mt-0">
          {figures.map((f) => (
            <div key={f.label} className="flex flex-col-reverse rounded-xl border border-[var(--sidebar-line)] bg-[var(--sidebar-hover)] px-3 py-3 sm:px-4">
              <dt className="mt-1 text-[11px] leading-snug text-[var(--sidebar-muted)] sm:text-xs">{t(f.label)}</dt>
              <dd className="font-mono text-xl font-semibold tabular-nums sm:text-2xl">{f.value === null ? "—" : formatAdminNumber(f.value, lang)}</dd>
            </div>
          ))}
        </dl>
      </aside>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8 lg:py-16">
        <LoginForm notice={notice} disabled={Boolean(problem)} />
      </section>
    </div>
  );
}

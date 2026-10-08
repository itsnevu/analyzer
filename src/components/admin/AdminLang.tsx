"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useTransition } from "react";
import { clsx } from "@/lib/clsx";
import { ADMIN_LANG_COOKIE, ADMIN_LANG_MAX_AGE, makeAdminT, type AdminLang, type AdminT } from "@/lib/admin-lang";

interface AdminLangCtx {
  lang: AdminLang;
  t: AdminT;
  setLang: (lang: AdminLang) => void;
  pending: boolean;
}

const Ctx = createContext<AdminLangCtx>({ lang: "en", t: makeAdminT("en"), setLang: () => {}, pending: false });

/** Gives every admin client component the panel language; the server reads the same cookie. */
export function AdminLangProvider({ lang, children }: { lang: AdminLang; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const setLang = useCallback(
    (next: AdminLang) => {
      if (next === lang) return;
      const secure = window.location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${ADMIN_LANG_COOKIE}=${next}; path=/; max-age=${ADMIN_LANG_MAX_AGE}; samesite=lax${secure}`;
      // Server components render the text, so they are fetched again in the new language.
      startTransition(() => router.refresh());
    },
    [lang, router],
  );

  const value = useMemo(() => ({ lang, t: makeAdminT(lang), setLang, pending }), [lang, setLang, pending]);
  return (
    <Ctx.Provider value={value}>
      <div lang={lang} className="contents">
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** `const { t, lang } = useAdminT();` in an admin client component. */
export function useAdminT(): AdminLangCtx {
  return useContext(Ctx);
}

/** The ID/EN switch in the admin top bar and on the login page. */
export function AdminLangSwitch({ className }: { className?: string }) {
  const { lang, setLang, pending, t } = useAdminT();
  const options: { value: AdminLang; label: string; name: string }[] = [
    { value: "id", label: "ID", name: "Bahasa Indonesia" },
    { value: "en", label: "EN", name: "English" },
  ];
  return (
    <div
      role="group"
      aria-label={t("Panel language")}
      className={clsx("flex h-9 items-center rounded-full border border-hairline bg-surface-sunken p-0.5 text-xs font-semibold", pending && "opacity-60", className)}
    >
      {options.map((o) => {
        const active = o.value === lang;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setLang(o.value)}
            aria-pressed={active}
            title={o.name}
            lang={o.value}
            className={clsx(
              "h-full rounded-full px-2.5 transition-colors",
              active ? "bg-ink text-surface-raised" : "text-ink-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

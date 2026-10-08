"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useTransition } from "react";
import { makeSiteT, SITE_LANG_COOKIE, SITE_LANG_MAX_AGE, type SiteLang, type SiteT } from "./site-lang";

/**
 * The public site's language for client components. The root layout reads the
 * cookie and passes the language in, so server and client render the same
 * text; see ./site-lang for how keys are looked up.
 */

interface I18nCtx {
  lang: SiteLang;
  t: SiteT;
  setLang: (lang: SiteLang) => void;
  pending: boolean;
}

const Ctx = createContext<I18nCtx>({ lang: "en", t: makeSiteT("en"), setLang: () => {}, pending: false });

export function LangProvider({ lang = "en", children }: { lang?: SiteLang; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const setLang = useCallback(
    (next: SiteLang) => {
      if (next === lang) return;
      const secure = window.location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${SITE_LANG_COOKIE}=${next}; path=/; max-age=${SITE_LANG_MAX_AGE}; samesite=lax${secure}`;
      document.documentElement.lang = next;
      // Server components render most of the text, so they are fetched again in the new language.
      startTransition(() => router.refresh());
    },
    [lang, router],
  );

  const value = useMemo(() => ({ lang, t: makeSiteT(lang), setLang, pending }), [lang, setLang, pending]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `const { t, lang } = useI18n();` in a public client component. */
export function useI18n() {
  return useContext(Ctx);
}

/** Inline translated text: <T k="hero.badge" /> */
export function T({ k }: { k: string }) {
  const { t } = useI18n();
  return <>{t(k)}</>;
}

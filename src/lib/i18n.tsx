"use client";

import { createContext, useContext } from "react";
import { DICT, type Lang } from "./dictionary";

interface I18nCtx {
  lang: Lang;
  t: (key: string) => string;
}

// The site is English-only; the dictionary lookup is kept so copy stays in one place.
const LANG: Lang = "en";
const t = (key: string) => DICT[LANG][key] ?? key;

const Ctx = createContext<I18nCtx>({ lang: LANG, t });

export function LangProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={{ lang: LANG, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

/** Inline translated text: <T k="hero.badge" /> */
export function T({ k }: { k: string }) {
  const { t } = useI18n();
  return <>{t(k)}</>;
}

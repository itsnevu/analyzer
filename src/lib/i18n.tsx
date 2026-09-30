"use client";

import { createContext, useContext } from "react";
import { DICT } from "./dictionary";

/**
 * UI strings live in ./dictionary so copy stays in one place. The site is
 * English-only; this context only provides the lookup.
 */

interface I18nCtx {
  t: (key: string) => string;
}

const t = (key: string) => DICT[key] ?? key;

const Ctx = createContext<I18nCtx>({ t });

export function LangProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={{ t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

/** Inline translated text: <T k="hero.badge" /> */
export function T({ k }: { k: string }) {
  return <>{t(k)}</>;
}

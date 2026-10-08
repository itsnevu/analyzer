import { cookies } from "next/headers";
import { makeSiteT, parseSiteLang, SITE_LANG_COOKIE, type SiteLang, type SiteT } from "./site-lang";

/** The visitor's language for a server component or generateMetadata (English unless they picked ID). */
export async function getSiteLang(): Promise<SiteLang> {
  return parseSiteLang((await cookies()).get(SITE_LANG_COOKIE)?.value);
}

/** `const { t, lang } = await getSiteT();` in a server component or generateMetadata. */
export async function getSiteT(): Promise<{ lang: SiteLang; t: SiteT }> {
  const lang = await getSiteLang();
  return { lang, t: makeSiteT(lang) };
}

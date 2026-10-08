import { cookies } from "next/headers";
import { ADMIN_LANG_COOKIE, makeAdminT, parseAdminLang, type AdminLang, type AdminT } from "./admin-lang";

/** The admin language for a server component (from the cookie the ID/EN switch sets). */
export async function getAdminLang(): Promise<AdminLang> {
  return parseAdminLang((await cookies()).get(ADMIN_LANG_COOKIE)?.value);
}

/** The language and its translate function, for an admin server component: `const { t, lang } = await getAdminT();` */
export async function getAdminT(): Promise<{ lang: AdminLang; t: AdminT }> {
  const lang = await getAdminLang();
  return { lang, t: makeAdminT(lang) };
}

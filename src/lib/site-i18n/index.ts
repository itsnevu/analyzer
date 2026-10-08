import { api } from "./api";
import { articles } from "./articles";
import { core } from "./core";
import { detector } from "./detector";
import { home } from "./home";
import { pages } from "./pages";

/** Every area's dictionary, for the consistency test. */
export const SITE_ID_AREAS: Record<string, Record<string, string>> = { core, home, pages, detector, articles, api };

/** Indonesian public-site strings, keyed by a lib/dictionary key or by their English text. */
export const SITE_ID: Record<string, string> = Object.assign({}, ...Object.values(SITE_ID_AREAS));

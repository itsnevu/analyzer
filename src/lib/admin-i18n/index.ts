import { api } from "./api";
import { common } from "./common";
import { content } from "./content";
import { dashboard } from "./dashboard";
import { data } from "./data";
import { shell } from "./shell";

/** Every area's dictionary, for the consistency test. */
export const ID_AREAS: Record<string, Record<string, string>> = { common, shell, dashboard, content, data, api };

/** Indonesian admin strings keyed by their English text. */
export const ID: Record<string, string> = Object.assign({}, ...Object.values(ID_AREAS));

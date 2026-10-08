import type { Verdict } from "./detect";
import { tk } from "./site-lang";

/**
 * Site-language keys for the verdict and language names the public pages show;
 * render them with t(VERDICT_LABEL[verdict]). Indonesian: lib/site-i18n/detector.ts.
 * Safe for client and server code.
 */
export const VERDICT_LABEL: Record<Verdict, string> = {
  hoax: tk("Hoax"),
  misleading: tk("Misleading"),
  valid: tk("Credible"),
};

/** The language an archive entry or a checked text is written in. */
export const LANGUAGE_LABEL: Record<"id" | "en", string> = {
  id: tk("Indonesian"),
  en: tk("English"),
};

/** Categories the detector itself assigns (archive entries carry their own, which are data). */
export const DETECTOR_CATEGORIES: readonly string[] = [
  tk("Disinformation"),
  tk("Misinformation"),
  tk("Verified"),
  tk("Hoax"),
  tk("Misleading"),
  tk("Credible"),
];

/** Fixed signal labels the detector writes; the heuristic's keyword cues are the user's own words and stay as they are. */
export const DETECTOR_SIGNALS: readonly string[] = [
  tk("very short text"),
  tk("excessive exclamation marks"),
  tk("excessive capitals"),
  tk("matches an archived fact-check"),
];

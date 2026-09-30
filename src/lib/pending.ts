/** sessionStorage key for text handed from the home page to the detector. Client-only. */
export const PENDING_TEXT_KEY = "hoax-analyzer:pending";

/**
 * Text the detector should open with: what the home page paste box saved, or
 * what another app shared to the installed web app (`?text=`, `?title=`,
 * `?url=` from the manifest's share_target). Clears both once read.
 */
export function takePendingText(): { text: string; run: boolean; from: "home" | "share" } | null {
  let text = "";
  let run = false;
  let from: "home" | "share" = "home";
  const params = new URLSearchParams(window.location.search);
  try {
    const saved = sessionStorage.getItem(PENDING_TEXT_KEY);
    if (saved) {
      sessionStorage.removeItem(PENDING_TEXT_KEY);
      text = saved;
      run = params.get("run") === "1";
    }
  } catch {
    /* storage unavailable */
  }
  if (!text) {
    // A share from WhatsApp arrives as `text`; some apps put the message in `title` or only send a `url`.
    const shared = [params.get("title"), params.get("text"), params.get("url")]
      .filter((p): p is string => !!p && p.trim().length > 0)
      .filter((p, i, all) => all.findIndex((x) => x.includes(p)) === i);
    text = shared.join("\n").trim();
    run = text.length > 0;
    from = "share";
  }
  if (params.has("run") || params.has("text") || params.has("title") || params.has("url")) {
    window.history.replaceState(null, "", window.location.pathname);
  }
  return text ? { text, run, from } : null;
}

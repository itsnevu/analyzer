/**
 * Keyboard shortcuts of the admin panel: the "g then a letter" jumps and the
 * list the shortcuts dialog shows. Pure, so it is safe for client code and
 * easy to test.
 */

/** "g" then this key goes to the page. */
export const GO_TARGETS: Record<string, { href: string; label: string }> = {
  d: { href: "/admin", label: "Dashboard" },
  a: { href: "/admin/articles", label: "Articles" },
  r: { href: "/admin/reports", label: "Reports" },
  q: { href: "/admin/review", label: "Review queue" },
  n: { href: "/admin/attention", label: "Needs attention" },
  l: { href: "/admin/detect", label: "Detection lab" },
  s: { href: "/admin/settings", label: "Settings" },
};

/** How long after "g" the second key still counts, in milliseconds. */
export const SEQUENCE_WINDOW_MS = 1000;

/** When "g" was pressed (ms), or null when no sequence is pending. */
export type SequenceState = number | null;

export interface SequenceResult {
  state: SequenceState;
  /** the page to open when the key completed a sequence */
  href?: string;
  /** true when the key belongs to a sequence (the "g" itself or a completing key), so no one else should act on it */
  handled: boolean;
}

/**
 * Feeds one key press (already known not to be typed into a field and to have
 * no Ctrl/Cmd/Alt) to the "g" sequence matcher.
 */
export function matchSequence(state: SequenceState, key: string, now: number, windowMs = SEQUENCE_WINDOW_MS): SequenceResult {
  const k = key.toLowerCase();
  const pending = state !== null && now - state <= windowMs;
  if (pending) {
    const target = GO_TARGETS[k];
    if (target) return { state: null, href: target.href, handled: true };
    // "g g" restarts the window; anything else ends the sequence and is left alone.
    if (k === "g") return { state: now, handled: true };
    return { state: null, handled: false };
  }
  if (k === "g") return { state: now, handled: true };
  return { state: null, handled: false };
}

/** True when a key press lands in a text field, where shortcuts must not fire. */
export function isTypingTarget(target: { tagName?: string; isContentEditable?: boolean; type?: string } | null | undefined): boolean {
  if (!target) return false;
  const tag = (target.tagName ?? "").toUpperCase();
  if (target.isContentEditable) return true;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (target.type ?? "text").toLowerCase();
    return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(type);
  }
  return false;
}

export interface ShortcutGroup {
  title: string;
  items: { keys: string[][]; label: string }[];
}

/** What the shortcuts dialog lists. `keys` is a list of alternatives, each a sequence of keys. */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Anywhere in the panel",
    items: [
      { keys: [["Ctrl", "K"], ["⌘", "K"]], label: "Search pages and articles" },
      { keys: [["?"]], label: "Show this list" },
      { keys: [["Esc"]], label: "Close a dialog or the menu" },
    ],
  },
  {
    title: "Go to",
    items: Object.entries(GO_TARGETS).map(([key, t]) => ({ keys: [["g", key]], label: t.label })),
  },
  {
    title: "Article editor",
    items: [{ keys: [["Ctrl", "S"], ["⌘", "S"]], label: "Save the article" }],
  },
  {
    title: "Review queue",
    items: [
      { keys: [["1"]], label: "Mark as hoax" },
      { keys: [["2"]], label: "Mark as misleading" },
      { keys: [["3"]], label: "Mark as credible" },
      { keys: [["s"]], label: "Skip" },
      { keys: [["d"]], label: "Delete" },
    ],
  },
];

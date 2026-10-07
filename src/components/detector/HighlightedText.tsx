import type { DetectionSignal } from "@/lib/detect";

/**
 * The checked text with its risk markers highlighted: the sentences that carry
 * a marker get a tint, and the marker itself (a phrase such as "sebarkan",
 * shouting in capitals, stacked exclamation marks) is emphasized.
 */

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Character ranges [start, end) of every risk marker in the text, merged. */
function markerRanges(text: string, signals: DetectionSignal[]): [number, number][] {
  const found: [number, number][] = [];
  const add = (re: RegExp) => {
    for (const m of text.matchAll(re)) if (m.index !== undefined && m[0]) found.push([m.index, m.index + m[0].length]);
  };
  for (const s of signals) {
    if (s.kind !== "risk") continue;
    const label = s.label.toLowerCase();
    // Case matters here, so this one is matched without the "i" flag.
    if (label.includes("capital")) add(/\b[A-Z]{5,}\b/g);
    else if (label.includes("exclamation")) add(/!{2,}/g);
    else if (label.length >= 3 && label.length <= 60 && !label.includes("archived") && !label.includes("short text")) {
      // The baseline classifier labels its cues "word: vaksin" / "phrase: vaksin covid"; only the cue itself is in the text.
      const phrase = s.label.replace(/^(?:word|phrase):\s*/i, "");
      if (phrase.length >= 3) add(new RegExp(escape(phrase), "gi"));
    }
  }
  found.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of found) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

export function HighlightedText({ text, signals }: { text: string; signals: DetectionSignal[] }) {
  const shown = text.length > 3000 ? `${text.slice(0, 3000)}…` : text;
  const ranges = markerRanges(shown, signals);
  const cls = "whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-muted";
  if (!ranges.length) return <p className={cls}>{shown}</p>;

  // Sentences end at . ! ? or a line break; keep their offsets to place the marks.
  const sentences: { start: number; end: number }[] = [];
  for (const m of shown.matchAll(/[^.!?\n]+[.!?]*\s*|\n+/g)) if (m.index !== undefined) sentences.push({ start: m.index, end: m.index + m[0].length });

  return (
    <p className={cls}>
      {sentences.map(({ start, end }) => {
        const inside = ranges.filter(([a, b]) => a < end && b > start);
        const sentence = shown.slice(start, end);
        if (!inside.length) return <span key={start}>{sentence}</span>;
        const parts: React.ReactNode[] = [];
        let cursor = start;
        for (const [a, b] of inside) {
          const from = Math.max(a, start);
          const to = Math.min(b, end);
          if (from > cursor) parts.push(shown.slice(cursor, from));
          parts.push(
            <mark key={from} className="rounded bg-verdict-hoax/20 px-0.5 font-semibold text-verdict-hoax">
              {shown.slice(from, to)}
            </mark>,
          );
          cursor = to;
        }
        if (cursor < end) parts.push(shown.slice(cursor, end));
        return (
          <span key={start} className="rounded bg-verdict-hoax/10 text-ink">
            {parts}
          </span>
        );
      })}
    </p>
  );
}

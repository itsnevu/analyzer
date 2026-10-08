import { hostOf, outboundLink } from "@/lib/sources";
import { ArchiveIcon, ExternalIcon } from "@/components/ui/Icons";
import { URL_RE } from "./RichText";

interface Item {
  label: string;
  links: { url: string; href: string; host: string; archived: boolean }[];
}

/** Splits a stored reference block into one item per line, with the line's links pulled out. */
function parse(text: string): Item[] {
  // One link per line, even where the source listed several on one line.
  const lines = text.replace(/\s+(?=https?:\/\/)/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  const items: Item[] = [];
  for (const line of lines) {
    const urls = line.match(URL_RE) ?? [];
    const label = line
      .replace(URL_RE, "")
      // List markers the source typed: "1.", "(2)", "3)", "-", "•".
      .replace(/^(?:\(?\d{1,2}[.)]|[-–•*])\s*/, "")
      .replace(/[\s:–\-(]+$/, "")
      .trim();
    const links = urls.map((url) => {
      const out = outboundLink(url);
      return { url, href: out.href, host: hostOf(url) || url, archived: out.archived };
    });
    // A bare link on its own line is credited to the label of the line before it, when that line had none.
    const prev = items[items.length - 1];
    if (!label && links.length && prev && prev.links.length === 0) prev.links.push(...links);
    else items.push({ label, links });
  }
  return items;
}

const short = (s: string) => (s.length > 72 ? `${s.slice(0, 69)}…` : s);

/** The sources a fact-check cites, as a tidy list with outbound icons and archived-copy notes (`archivedNote`, in the page language). */
export function ReferenceList({ text, archivedNote }: { text: string; archivedNote: string }) {
  const items = parse(text);
  if (!items.length) return null;
  return (
    <ol className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface-raised">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 p-4 text-sm">
          <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-xs text-ink-faint">{i + 1}</span>
          <div className="min-w-0 flex-1">
            {item.label && <p className="break-words leading-relaxed text-ink">{item.label}</p>}
            {item.links.length > 0 && (
              <ul className={item.label ? "mt-1.5 space-y-1" : "space-y-1"}>
                {item.links.map((l, j) => (
                  <li key={j} className="min-w-0">
                    <a
                      href={l.href}
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                      title={l.url}
                      className="group inline-flex max-w-full items-center gap-1.5 text-brand hover:underline"
                    >
                      <span className="truncate">{item.label ? l.host : short(l.url.replace(/^https?:\/\/(www\.)?/, ""))}</span>
                      <ExternalIcon className="h-3 w-3 shrink-0" />
                    </a>
                    {l.archived && (
                      <span className="ml-2 inline-flex items-center gap-1 align-middle text-[11px] text-ink-faint">
                        <ArchiveIcon className="h-3 w-3" />
                        {archivedNote}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

import { clsx } from "@/lib/clsx";
import { outboundLink } from "@/lib/sources";

const URL_RE = /(https?:\/\/[^\s<>"'()]+[^\s<>"'().,;:!?])/g;

/** Renders stored plain text: one paragraph per line, URLs turned into links. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className={clsx("space-y-3 text-sm leading-relaxed text-ink", className)}>
      {lines.map((line, i) => {
        // A short line ending in a colon is a sub-heading inside the text ("Kesimpulan:").
        const heading = line.length <= 40 && /:$/.test(line) && !/https?:/.test(line);
        return (
          <p key={i} className={clsx("break-words", heading && "pt-1 font-semibold text-ink")}>
            {line.split(URL_RE).map((part, j) =>
              j % 2 === 1 ? (
                <a
                  key={j}
                  href={outboundLink(part).href}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="text-brand-to underline decoration-brand-to/40 underline-offset-2 hover:decoration-brand-to"
                >
                  {part.length > 80 ? `${part.slice(0, 77)}…` : part}
                </a>
              ) : (
                part
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}

import { Fragment, type ReactNode } from "react";

/**
 * Renders a translated sentence that contains inline elements, so the whole
 * sentence stays one dictionary entry and each language can put the link
 * where its grammar wants it:
 *
 *   rich(t(key), { link: (s) => <Link href="/report">{s}</Link> })
 *
 * where the English entry reads "Use the <link>report form</link>."
 *
 * Tags are <name>…</name>, not nested. A tag without a renderer shows its text.
 * Server-safe.
 */
export function rich(text: string, tags: Record<string, (chunk: string) => ReactNode>): ReactNode {
  const out: ReactNode[] = [];
  const re = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const render = tags[m[1]];
    out.push(<Fragment key={m.index}>{render ? render(m[2]) : m[2]}</Fragment>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

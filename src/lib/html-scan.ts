/**
 * Small HTML helpers for pages fetched from the web, written to run in linear
 * time on any input. A regex such as /<p\b[^>]*>([\s\S]*?)<\/p>/ rescans to
 * the end of the document from every unclosed tag, so a 2 MB page of "<p>"
 * kept the server busy for minutes; here every closing tag is found with one
 * forward search, and character classes never cross a "<". Safe for client
 * and server code.
 */

/** Opening tags and plain tags: never run past the next "<", so a page full of "<" stays linear. */
const ANY_TAG = /<[^<>]*>/g;

/** Text with every tag replaced by a space. */
export function stripTags(html: string): string {
  return html.replace(ANY_TAG, " ");
}

/** Drops <!-- comments -->; an unterminated comment drops the rest. */
export function removeComments(html: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    const start = html.indexOf("<!--", i);
    if (start < 0) return out + html.slice(i);
    out += html.slice(i, start) + " ";
    const end = html.indexOf("-->", start + 4);
    if (end < 0) return out;
    i = end + 3;
  }
}

/**
 * Finds the first "</tag" at or after `from`, remembering the last answer so a
 * run of unclosed opening tags costs one search in total, not one each.
 */
function closeFinder(lower: string) {
  const memo = new Map<string, number>();
  return (tag: string, from: number): number => {
    const known = memo.get(tag);
    // The first close after an earlier start is also the first after any later start before it.
    if (known !== undefined && (known === -1 || known >= from)) return known;
    const found = lower.indexOf(`</${tag}`, from);
    memo.set(tag, found);
    return found;
  };
}

/** Removes whole elements (<script>…</script>, <nav>…</nav>, …); an unclosed one drops the rest of the page. */
export function removeElements(html: string, tags: readonly string[]): string {
  const lower = html.toLowerCase();
  const findClose = closeFinder(lower);
  const open = new RegExp(`<(${tags.join("|")})\\b`, "gi");
  let out = "";
  let i = 0;
  for (let m = open.exec(html); m; m = open.exec(html)) {
    out += html.slice(i, m.index) + " ";
    const close = findClose(m[1].toLowerCase(), open.lastIndex);
    if (close < 0) return out;
    const gt = html.indexOf(">", close);
    i = gt < 0 ? html.length : gt + 1;
    open.lastIndex = i;
  }
  return out + html.slice(i);
}

/** The first <tag …>…</tag> element, outer HTML, or null. */
export function firstElement(html: string, tag: string): string | null {
  const m = new RegExp(`<${tag}\\b`, "i").exec(html);
  if (!m) return null;
  const close = html.toLowerCase().indexOf(`</${tag}`, m.index);
  if (close < 0) return null;
  const gt = html.indexOf(">", close);
  return html.slice(m.index, gt < 0 ? html.length : gt + 1);
}

/** The inner HTML of every <p>, <li>, … element, in document order (unclosed ones are skipped). */
export function elementContents(html: string, tags: readonly string[]): string[] {
  const lower = html.toLowerCase();
  const findClose = closeFinder(lower);
  const open = new RegExp(`<(${tags.join("|")})\\b[^<>]*>`, "gi");
  const out: string[] = [];
  for (let m = open.exec(html); m; m = open.exec(html)) {
    const close = findClose(m[1].toLowerCase(), open.lastIndex);
    if (close < 0) continue;
    out.push(html.slice(open.lastIndex, close));
    open.lastIndex = close;
  }
  return out;
}

/** Attributes of one tag's source ("<meta property='og:title' content='x'>"), names lower-cased. */
export function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    const name = m[1].toLowerCase();
    if (!(name in out)) out[name] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return out;
}

/** Every <tagName …> start tag's attributes, e.g. all <meta> or <link> tags. */
export function startTags(html: string, tagName: string): Record<string, string>[] {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^<>]*>`, "gi"))].map((m) => attributes(m[0]));
}

/** The content of <meta property|name|itemprop="name" content="…">, raw (entities not decoded), or "". */
export function metaContent(html: string, name: string): string {
  const wanted = name.toLowerCase();
  for (const a of startTags(html, "meta")) {
    const key = (a.property ?? a.name ?? a.itemprop ?? "").toLowerCase();
    if (key === wanted && a.content !== undefined) return a.content;
  }
  return "";
}

/** The href of <link rel="canonical">, or "". */
export function canonicalLink(html: string): string {
  for (const a of startTags(html, "link")) if ((a.rel ?? "").toLowerCase().split(/\s+/).includes("canonical") && a.href) return a.href;
  return "";
}

/** The text of <title>…</title>, raw, or "". */
export function titleText(html: string): string {
  const m = /<title\b[^<>]*>/i.exec(html);
  if (!m) return "";
  const end = html.indexOf("<", m.index + m[0].length);
  return html.slice(m.index + m[0].length, end < 0 ? html.length : end);
}

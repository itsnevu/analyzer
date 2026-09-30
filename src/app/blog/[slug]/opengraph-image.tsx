import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getArticleBySlug } from "@/lib/articles";
import { formatDate, sourceName } from "@/lib/sources";

export const runtime = "nodejs";
export const alt = "Fact-check verdict and title";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The image renderer does not read CSS variables, so the verdict colours are repeated here.
const VERDICT = {
  hoax: { label: "HOAX", color: "#b91c1c", tint: "#fbe9e9" },
  misleading: { label: "MISLEADING", color: "#b45309", tint: "#fbf0e4" },
  valid: { label: "CREDIBLE", color: "#15803d", tint: "#e6f4ea" },
} as const;

// The site's typeface, from the geist package (the renderer needs TTF, not the woff2 the pages use).
const FONT_DIR = path.join(process.cwd(), "node_modules", "geist", "dist", "fonts", "geist-sans");
function fonts() {
  try {
    return [
      { name: "Geist", data: fs.readFileSync(path.join(FONT_DIR, "Geist-Regular.ttf")), weight: 400 as const, style: "normal" as const },
      { name: "Geist", data: fs.readFileSync(path.join(FONT_DIR, "Geist-Bold.ttf")), weight: 700 as const, style: "normal" as const },
    ];
  } catch {
    return undefined; // falls back to the renderer's built-in font
  }
}

const TILES = [
  ["H", "#3b9199"],
  ["O", "#d1348c"],
  ["A", "#e2903f"],
  ["X", "#6d85a6"],
] as const;

/** Share preview for an article: the verdict, the claim and who checked it. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const article = await getArticleBySlug((await params).slug);
  const v = VERDICT[article?.verdict ?? "misleading"];
  const title = article ? (article.title.length > 150 ? `${article.title.slice(0, 147)}…` : article.title) : "Fact-check not found";
  const byline = article ? [article.sourceSite && `Fact-check by ${sourceName(article.sourceSite)}`, formatDate(article.date, "long")].filter(Boolean).join(" · ") : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#faf9f6", padding: 64, fontFamily: "Geist" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", width: 56, height: 56, gap: 4 }}>
            {TILES.map(([letter, color]) => (
              <div key={letter} style={{ width: 26, height: 26, borderRadius: 6, background: color, color: "#fff", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {letter}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#191817" }}>Hoax Analyzer</div>
        </div>

        <div style={{ display: "flex", marginTop: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: v.tint, color: v.color, borderRadius: 999, padding: "12px 28px", fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>
            <div style={{ width: 22, height: 22, borderRadius: 999, background: v.color }} />
            {v.label}
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 36, fontSize: title.length > 90 ? 48 : 58, fontWeight: 700, lineHeight: 1.15, color: "#191817" }}>{title}</div>

        <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", alignItems: "flex-end", fontSize: 26, color: "#57534e" }}>
          <div style={{ display: "flex" }}>{byline}</div>
          <div style={{ display: "flex", color: "#8f8b84" }}>syyhoaxanalyzer.com</div>
        </div>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 14, background: v.color }} />
      </div>
    ),
    { ...size, fonts: fonts() },
  );
}

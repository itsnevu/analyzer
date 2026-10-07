import { ExtractTool } from "@/components/admin/ExtractTool";

export const dynamic = "force-dynamic";
export const metadata = { title: "Extract from a page" };

export default function ExtractPage() {
  return (
    <div className="space-y-4">
      <div>
        <span className="eyebrow">Content</span>
        <h1 className="mt-2 font-display text-2xl font-bold">Extract from a page</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          Paste a fact-check link, a page&apos;s HTML or the text of a forwarded message. The tool fills in the article fields (title, verdict
          from the title tag, date, narration, explanation, references) for you to check, shows fact-checks already in the archive about the
          same claim, and saves the result as a hidden draft or a published article.
        </p>
      </div>
      <ExtractTool />
    </div>
  );
}

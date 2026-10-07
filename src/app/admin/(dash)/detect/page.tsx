import { DetectLab } from "@/components/admin/DetectLab";
import { countStopwords } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detection lab" };

export default async function DetectLabPage() {
  const stopwords = countStopwords();
  const modelConfigured = Boolean(process.env.RAG_FUSION_API_URL);

  return (
    <div className="space-y-4">
      <div>
        <span className="eyebrow">Detector</span>
        <h1 className="mt-2 font-display text-2xl font-bold">Detection lab</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          Score a text, or the page behind a link, against the archive with one similarity algorithm and see every stage with its timing,
          next to the verdict the detector itself gives. Stopwords come from Settings. Runs here are not written to the search statistics or
          the research log.
        </p>
      </div>
      <DetectLab stopwords={stopwords} modelConfigured={modelConfigured} />
    </div>
  );
}

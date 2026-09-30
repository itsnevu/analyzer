import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetectorPanel } from "@/components/detector/DetectorPanel";

export const metadata: Metadata = {
  title: "Hoax Detector",
  description:
    "Paste a news text or chain message and get a hoax assessment with references. Supports Indonesian & English.",
};

export default function DetectorPage() {
  return (
    <>
      <PageHeader
        eyebrowKey="det.eyebrow"
        titleKey="det.title.a"
        highlightKey="det.title.hoax"
        introKey="det.intro"
        image="/pages/detector.jpg?v=2"
      />
      <section className="container-page pb-8">
        <DetectorPanel />
      </section>
    </>
  );
}

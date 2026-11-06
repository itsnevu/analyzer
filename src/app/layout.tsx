import type { Metadata, Viewport } from "next";
import { Hedvig_Letters_Serif, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const hedvig = Hedvig_Letters_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hedvig",
  display: "swap",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-mono",
  display: "swap",
});
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { ServiceWorker } from "@/components/ui/ServiceWorker";
import { UsageBeacon } from "@/components/ui/UsageBeacon";
import { SITE_URL } from "@/lib/site";
import { LangProvider } from "@/lib/i18n";
import { getSiteT } from "@/lib/site-lang-server";

const jsonLd = (description: string) => ({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Hoax Detection & Analyzer",
  applicationCategory: "SecurityApplication",
  operatingSystem: "Web",
  description,
  inLanguage: ["id", "en"],
  offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
});


export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await getSiteT();
  const short = t("Hoax detection and analysis for Indonesian & English, backed by thousands of fact-checks.");
  return {
    title: {
      default: "Hoax Detection & Analyzer",
      template: "%s · Hoax Detection & Analyzer",
    },
    description: t("Analyze Indonesian & English hoax news with text-mining, machine learning and thousands of fact-checks. Paste the text, get a verdict and an explanation."),
    metadataBase: new URL(SITE_URL),
    applicationName: "Hoax Analyzer",
    appleWebApp: { capable: true, title: "Hoax Analyzer", statusBarStyle: "default" },
    icons: { apple: "/icons/apple-touch-icon.png" },
    alternates: {
      types: { "application/rss+xml": [{ url: "/feed.xml", title: t("Hoax Detection & Analyzer — latest fact-checks") }] },
    },
    openGraph: {
      title: "Hoax Detection & Analyzer",
      description: short,
      type: "website",
      locale: lang === "id" ? "id_ID" : "en_US",
      images: [{ url: "/og.jpg", width: 1200, height: 675 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Hoax Detection & Analyzer",
      description: short,
      images: ["/og.jpg"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0e0e10",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // English unless the visitor picked ID in the header switch.
  const { t, lang } = await getSiteT();
  return (
    <html lang={lang} className={`${instrument.variable} ${hedvig.variable} ${jetbrains.variable}`}>
      <head />
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(t("Hoax detection and analysis for Indonesian & English text, built on text-mining, machine learning and an archive of fact-checks."))) }}
        />
        <LangProvider lang={lang}>
          <ScrollProgress />
          <Navbar />
          <main className="min-h-[70vh]">{children}</main>
          <Footer />
        </LangProvider>
        <ServiceWorker lang={lang} />
        <UsageBeacon />
      </body>
    </html>
  );
}

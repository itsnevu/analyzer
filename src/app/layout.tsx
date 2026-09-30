import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
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
import { LangProvider } from "@/lib/i18n";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Hoax Detection & Analyzer",
  applicationCategory: "SecurityApplication",
  operatingSystem: "Web",
  description:
    "Hoax detection and analysis for Indonesian & English text, built on text-mining, machine learning, and RAG Fusion.",
  inLanguage: ["id", "en"],
  offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
};

export const metadata: Metadata = {
  title: {
    default: "Hoax Detection & Analyzer",
    template: "%s · Hoax Detection & Analyzer",
  },
  description:
    "Analyze Indonesian & English hoax news with text-mining, machine learning, and RAG Fusion. Paste the text, get a verdict and an explanation.",
  metadataBase: new URL("https://syyhoaxanalyzer.com"),
  applicationName: "Hoax Analyzer",
  appleWebApp: { capable: true, title: "Hoax Analyzer", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    title: "Hoax Detection & Analyzer",
    description:
      "RAG Fusion-based hoax detection and analysis for Indonesian & English.",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 675 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hoax Detection & Analyzer",
    description:
      "RAG Fusion-based hoax detection and analysis for Indonesian & English.",
    images: ["/og.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#faf9f6",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${fraunces.variable} ${jetbrains.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <LangProvider>
          <ScrollProgress />
          <Navbar />
          <main className="min-h-[70vh]">{children}</main>
          <Footer />
        </LangProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}

import type { MetadataRoute } from "next";

/**
 * Makes the site installable. On Android the installed app also appears in the
 * share sheet: sharing a WhatsApp message to it opens the detector with the
 * text filled in (see share_target and src/lib/pending.ts).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Hoax Detection & Analyzer",
    short_name: "Hoax Analyzer",
    description: "Paste or share a message to check it against thousands of fact-checks.",
    start_url: "/detector",
    scope: "/",
    display: "standalone",
    background_color: "#faf9f6",
    theme_color: "#faf9f6",
    lang: "en",
    categories: ["news", "utilities", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/detector",
      method: "get",
      params: { title: "title", text: "text", url: "url" },
    },
    shortcuts: [
      { name: "Check a message", url: "/detector", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Search the archive", url: "/blog", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

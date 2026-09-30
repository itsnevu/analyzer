import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/articles";

export const dynamic = "force-dynamic";

const BASE = "https://syyhoaxanalyzer.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = ["", "/detector", "/blog", "/disclaimer", "/report", "/contact", "/about"];
  const staticPages: MetadataRoute.Sitemap = routes.map((r) => ({
    url: `${BASE}${r}`,
    lastModified: new Date(),
    changeFrequency: r === "" || r === "/blog" ? "daily" : "monthly",
    priority: r === "" ? 1 : r === "/detector" ? 0.9 : 0.6,
  }));
  const articlePages: MetadataRoute.Sitemap = (await getSitemapEntries()).map((a) => ({
    url: `${BASE}/blog/${a.slug}`,
    ...(a.date ? { lastModified: new Date(`${a.date}T00:00:00Z`) } : {}),
    changeFrequency: "yearly",
    priority: 0.5,
  }));
  return [...staticPages, ...articlePages];
}

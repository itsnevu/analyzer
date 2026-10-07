import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/articles";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const BASE = SITE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = ["", "/detector", "/blog", "/stats", "/disclaimer", "/report", "/contact", "/about", "/privacy"];
  const staticPages: MetadataRoute.Sitemap = routes.map((r) => ({
    url: `${BASE}${r}`,
    lastModified: new Date(),
    changeFrequency: r === "" || r === "/blog" || r === "/stats" ? "daily" : "monthly",
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

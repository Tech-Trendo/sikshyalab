import type { MetadataRoute } from "next";
import { fetchSeoSitemap, SITE_URL } from "@/lib/seo";

const FALLBACK_PATHS = [
  "/",
  "/courses",
  "/about",
  "/blog",
  "/events",
  "/contact",
  "/faq",
  "/gallery",
  "/career",
  "/verify",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await fetchSeoSitemap();
  const active = entries.filter((e) => e.is_active !== false);

  if (!active.length) {
    return FALLBACK_PATHS.map((path) => ({
      url: `${SITE_URL}${path === "/" ? "" : path}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: path === "/" ? 1 : 0.7,
    }));
  }

  return active.map((entry) => {
    const path = entry.url_path.startsWith("/") ? entry.url_path : `/${entry.url_path}`;
    return {
      url: `${SITE_URL}${path === "/" ? "" : path}`,
      lastModified: entry.lastmod ? new Date(entry.lastmod) : new Date(),
      changeFrequency: (entry.changefreq as MetadataRoute.Sitemap[0]["changeFrequency"]) || "weekly",
      priority: Number(entry.priority ?? 0.5),
    };
  });
}

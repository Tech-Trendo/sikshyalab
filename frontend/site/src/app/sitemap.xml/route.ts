import { NextResponse } from "next/server";
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
  "/verify",
];

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const entries = await fetchSeoSitemap();
  const active = entries.filter((e) => e.is_active !== false);

  const items = active.length
    ? active.map((entry) => {
        const path = entry.url_path.startsWith("/") ? entry.url_path : `/${entry.url_path}`;
        return {
          loc: `${SITE_URL}${path === "/" ? "" : path}`,
          lastmod: entry.lastmod ? new Date(entry.lastmod) : new Date(),
          changefreq: entry.changefreq || "weekly",
          priority: Number(entry.priority ?? 0.5),
        };
      })
    : FALLBACK_PATHS.map((path) => ({
        loc: `${SITE_URL}${path === "/" ? "" : path}`,
        lastmod: new Date(),
        changefreq: "weekly",
        priority: path === "/" ? 1 : 0.7,
      }));

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items
  .map(
    (item) => `  <url>
    <loc>${xmlEscape(item.loc)}</loc>
    <lastmod>${item.lastmod.toISOString()}</lastmod>
    <changefreq>${xmlEscape(String(item.changefreq))}</changefreq>
    <priority>${item.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
}

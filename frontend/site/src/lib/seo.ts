/**
 * Public SEO helpers for the Next.js marketing site.
 *
 * Do not add og_title / og_description / og_image on SiteSetting.
 * Site settings only supply fallbacks (site_name, tagline, logo).
 * Per-path OG lives in `/api/v1/seo/lookup/`.
 * Blog, course, and event pages use `meta_title`, `meta_description`, and `og_image` on the object.
 *
 * Social images should be 1200×630px (absolute URLs). Relative paths are resolved here.
 */

import type { Metadata } from "next";
import { apiBase, resolveMediaUrl } from "@/lib/env";

export type PublicSeoMetadata = {
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  slug?: string;
  canonical_url?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string | null;
  og_type?: string;
  twitter_card?: string;
  twitter_title?: string;
  twitter_description?: string;
  twitter_image?: string | null;
  robots?: string;
  structured_data?: Record<string, unknown> | null;
  focus_keyword?: string;
  seo_score?: number;
  is_indexed?: boolean;
};

export type SitemapApiEntry = {
  id?: string | number;
  url_path: string;
  changefreq?: string;
  priority?: number | string;
  lastmod?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SitemapFetchResult =
  | { ok: true; entries: SitemapApiEntry[] }
  | { ok: false; entries: []; error: string };

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:8081").replace(/\/$/, "");

/** Facebook / LinkedIn / Twitter large-card preview size. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

const FALLBACK_SITE_NAME = "shikshalab";
const FALLBACK_TAGLINE =
  "Learn in-demand tech skills from industry experts. Live batches, hands-on projects, and verified certificates.";

export type SiteSeoDefaults = {
  siteName: string;
  tagline: string;
  logo?: string;
};

/** Absolute API base for SSR (relative `/api/v1` only works in the browser). */
function resolveApiBase(): string {
  const configured = apiBase();
  if (configured.startsWith("http://") || configured.startsWith("https://")) {
    return configured.replace(/\/$/, "");
  }
  const django =
    (
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_PROXY_TARGET ||
      process.env.NEXT_PUBLIC_DJANGO_ORIGIN ||
      "http://localhost:8000"
    ).replace(/\/$/, "");
  try {
    return `${new URL(django.includes("://") ? django : `http://${django}`).origin}/api/v1`;
  } catch {
    return `${django.replace(/\/api\/v1\/?$/, "")}/api/v1`;
  }
}

async function seoFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${resolveApiBase()}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (body && typeof body === "object" && "data" in body) return body.data as T;
    return body as T;
  } catch {
    return null;
  }
}

export async function fetchSeoByPath(path: string): Promise<PublicSeoMetadata | null> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const qs = new URLSearchParams({ path: normalized });
  return seoFetch<PublicSeoMetadata>(`/seo/lookup/?${qs.toString()}`);
}

function sitemapRowsFromBody(body: unknown): SitemapApiEntry[] {
  if (!body || typeof body !== "object") return [];
  const envelope = body as { data?: unknown; results?: unknown };
  const data = "data" in envelope ? envelope.data : body;
  if (Array.isArray(data)) return data as SitemapApiEntry[];
  if (data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: SitemapApiEntry[] }).results;
  }
  if (Array.isArray(envelope.results)) return envelope.results as SitemapApiEntry[];
  return [];
}

function sitemapTotalPages(body: unknown, rows: SitemapApiEntry[], pageSize: number): number {
  if (!body || typeof body !== "object") return 1;
  const meta = (body as { meta?: { total_pages?: number; next?: string | null } }).meta;
  if (meta?.total_pages) return Number(meta.total_pages) || 1;
  if (meta?.next) return Number.POSITIVE_INFINITY;
  return rows.length < pageSize ? 1 : 2;
}

/**
 * Paginated read of `/seo/sitemap/` with an explicit success/error result.
 * Used by the HTML sitemap page (loading / empty / error states).
 */
export async function fetchSeoSitemapResult(options?: {
  revalidate?: number;
}): Promise<SitemapFetchResult> {
  const base = typeof window !== "undefined" ? apiBase() : resolveApiBase();
  const pageSize = 100;

  try {
    const all: SitemapApiEntry[] = [];
    for (let page = 1; page <= 50; page += 1) {
      const init: RequestInit & { next?: { revalidate: number } } = {
        headers: { Accept: "application/json" },
      };
      if (options?.revalidate != null) {
        init.next = { revalidate: options.revalidate };
      } else {
        init.cache = "no-store";
      }

      const res = await fetch(`${base}/seo/sitemap/?page=${page}&page_size=${pageSize}`, init);
      if (!res.ok) {
        if (all.length) break;
        return { ok: false, entries: [], error: `Could not load sitemap (${res.status}).` };
      }

      const body = await res.json();
      const rows = sitemapRowsFromBody(body);
      all.push(...rows);

      const totalPages = sitemapTotalPages(body, rows, pageSize);
      if (page >= totalPages || rows.length === 0 || rows.length < pageSize) break;
    }

    return { ok: true, entries: all };
  } catch {
    return { ok: false, entries: [], error: "Could not load sitemap. Please try again." };
  }
}

export async function fetchSeoSitemap(): Promise<SitemapApiEntry[]> {
  const result = await fetchSeoSitemapResult({ revalidate: 120 });
  return result.ok ? result.entries : [];
}

function absoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return undefined;
  const media = resolveMediaUrl(trimmed);
  if (media && (media.startsWith("http://") || media.startsWith("https://"))) return media;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/")) return `${SITE_URL}${trimmed}`;
  return trimmed;
}

export async function fetchSiteDefaults(): Promise<SiteSeoDefaults> {
  const settings = await seoFetch<{
    site_name?: string;
    tagline?: string;
    logo?: string | null;
  }>("/cms/settings/current/");
  const siteName = settings?.site_name?.trim() || FALLBACK_SITE_NAME;
  const tagline = settings?.tagline?.trim() || FALLBACK_TAGLINE;
  const logo = absoluteUrl(settings?.logo) || `${SITE_URL}/shikshalab-logo.png`;
  return { siteName, tagline, logo };
}

function normalizePath(path: string): string {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return withSlash.replace(/\/$/, "") || "/";
}

/** Ignore CMS SEO that belongs to a different URL (bad lookup / loose match). */
function seoMatchesPath(seo: PublicSeoMetadata, path: string): boolean {
  const pathNorm = normalizePath(path);
  if (seo.canonical_url) {
    try {
      const raw = seo.canonical_url.startsWith("http")
        ? new URL(seo.canonical_url).pathname
        : seo.canonical_url;
      return normalizePath(raw) === pathNorm;
    } catch {
      return false;
    }
  }
  if (seo.slug) {
    if (pathNorm === "/") return false;
    return pathNorm.split("/").pop() === seo.slug;
  }
  return true;
}

export function seoToNextMetadata(
  seo: PublicSeoMetadata | null | undefined,
  fallback: {
    title?: string;
    description?: string;
    path?: string;
    siteName?: string;
    image?: string | null;
    ogType?: "website" | "article";
  } = {},
): Metadata {
  const safeSeo =
    seo && fallback.path && !seoMatchesPath(seo, fallback.path) ? null : seo;
  const title = safeSeo?.meta_title || fallback.title;
  const description = safeSeo?.meta_description || fallback.description;
  const siteName = fallback.siteName || FALLBACK_SITE_NAME;
  const canonical =
    absoluteUrl(safeSeo?.canonical_url) ||
    (fallback.path ? `${SITE_URL}${fallback.path.startsWith("/") ? fallback.path : `/${fallback.path}`}` : undefined);
  const ogImage =
    absoluteUrl(safeSeo?.og_image as string | undefined) || absoluteUrl(fallback.image);
  const twitterImage = absoluteUrl((safeSeo?.twitter_image as string | undefined) || ogImage);
  const robots = safeSeo?.robots || (safeSeo?.is_indexed === false ? "noindex,nofollow" : "index,follow");
  const ogType = (safeSeo?.og_type as "website" | "article") || fallback.ogType || "website";
  const socialTitle = safeSeo?.og_title || title || siteName;
  const socialDescription = safeSeo?.og_description || description || undefined;
  const twitterTitle = safeSeo?.twitter_title || socialTitle;
  const twitterDescription = safeSeo?.twitter_description || socialDescription;

  return {
    title: title || undefined,
    description: description || undefined,
    keywords: safeSeo?.meta_keywords
      ? safeSeo.meta_keywords.split(",").map((k) => k.trim()).filter(Boolean)
      : undefined,
    alternates: canonical ? { canonical } : undefined,
    robots,
    openGraph: {
      type: ogType,
      title: socialTitle,
      description: socialDescription,
      url: canonical,
      siteName,
      images: ogImage
        ? [
            {
              url: ogImage,
              width: OG_IMAGE_WIDTH,
              height: OG_IMAGE_HEIGHT,
              alt: socialTitle,
            },
          ]
        : undefined,
    },
    twitter: {
      card:
        (safeSeo?.twitter_card as "summary" | "summary_large_image") ||
        (ogImage ? "summary_large_image" : "summary"),
      title: twitterTitle,
      description: twitterDescription,
      images: twitterImage ? [twitterImage] : undefined,
    },
  };
}

export async function getPageMetadata(
  path: string,
  fallback: { title?: string; description?: string } = {},
): Promise<Metadata> {
  const [seo, defaults] = await Promise.all([fetchSeoByPath(path), fetchSiteDefaults()]);
  return seoToNextMetadata(seo, {
    title: fallback.title || defaults.siteName,
    description: fallback.description || defaults.tagline,
    path,
    siteName: defaults.siteName,
    image: defaults.logo,
  });
}

export function stripToPlain(raw?: string | null, max = 160): string {
  if (!raw) return "";
  const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

/** SEO from Blog/Course/Event fields — do not call `/seo/lookup` for these models. */
export async function metadataFromEntity(
  entity: {
    meta_title?: string | null;
    meta_description?: string | null;
    og_image?: string | null;
  } | null | undefined,
  fallback: {
    title: string;
    description: string;
    path: string;
    image?: string | null;
    ogType?: "website" | "article";
  },
): Promise<Metadata> {
  const defaults = await fetchSiteDefaults();
  const title = entity?.meta_title?.trim() || fallback.title;
  const description = entity?.meta_description?.trim() || fallback.description;
  const og = entity?.og_image || fallback.image || defaults.logo;
  return seoToNextMetadata(
    {
      meta_title: title,
      meta_description: description,
      og_image: og,
      og_title: title,
      og_description: description,
      og_type: fallback.ogType || "website",
    },
    {
      title,
      description,
      path: fallback.path,
      siteName: defaults.siteName,
      image: og,
      ogType: fallback.ogType,
    },
  );
}

export { SITE_URL };

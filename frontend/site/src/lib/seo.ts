/**
 * Public SEO helpers for the Next.js marketing site.
 * Reads from Django `/api/v1/seo/lookup/` and `/api/v1/seo/sitemap/`.
 */

import type { Metadata } from "next";
import { apiBase } from "@/lib/env";

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
  url_path: string;
  changefreq?: string;
  priority?: number | string;
  lastmod?: string | null;
  is_active?: boolean;
};

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:8081").replace(/\/$/, "");

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

export async function fetchSeoSitemap(): Promise<SitemapApiEntry[]> {
  const data = await seoFetch<SitemapApiEntry[] | { results?: SitemapApiEntry[] }>("/seo/sitemap/");
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function absoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${SITE_URL}${url}`;
  return url;
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
  fallback: { title?: string; description?: string; path?: string } = {},
): Metadata {
  const safeSeo =
    seo && fallback.path && !seoMatchesPath(seo, fallback.path) ? null : seo;
  const title = safeSeo?.meta_title || fallback.title;
  const description = safeSeo?.meta_description || fallback.description;
  const canonical =
    absoluteUrl(safeSeo?.canonical_url) ||
    (fallback.path ? `${SITE_URL}${fallback.path.startsWith("/") ? fallback.path : `/${fallback.path}`}` : undefined);
  const ogImage = absoluteUrl(safeSeo?.og_image as string | undefined);
  const twitterImage = absoluteUrl((safeSeo?.twitter_image as string | undefined) || ogImage);
  const robots = safeSeo?.robots || (safeSeo?.is_indexed === false ? "noindex,nofollow" : "index,follow");

  return {
    title: title || undefined,
    description: description || undefined,
    keywords: safeSeo?.meta_keywords
      ? safeSeo.meta_keywords.split(",").map((k) => k.trim()).filter(Boolean)
      : undefined,
    alternates: canonical ? { canonical } : undefined,
    robots,
    openGraph: {
      type: (safeSeo?.og_type as "website" | "article") || "website",
      title: safeSeo?.og_title || title || undefined,
      description: safeSeo?.og_description || description || undefined,
      url: canonical,
      siteName: "skillsikshya",
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: (safeSeo?.twitter_card as "summary" | "summary_large_image") || "summary_large_image",
      title: safeSeo?.twitter_title || safeSeo?.og_title || title || undefined,
      description: safeSeo?.twitter_description || safeSeo?.og_description || description || undefined,
      images: twitterImage ? [twitterImage] : undefined,
    },
  };
}

export async function getPageMetadata(
  path: string,
  fallback: { title?: string; description?: string } = {},
): Promise<Metadata> {
  const seo = await fetchSeoByPath(path);
  return seoToNextMetadata(seo, { ...fallback, path });
}

export { SITE_URL };

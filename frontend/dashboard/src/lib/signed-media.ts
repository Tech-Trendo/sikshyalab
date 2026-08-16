/** Helpers for authenticated same-origin resource streaming (never S3/GCS URLs). */

import { contentEndpoints } from "@/lib/api-endpoints";

export type SecureMediaKind = "video" | "image" | "pdf" | "notes" | "other";

export function normalizeSecureMediaKind(
  raw: unknown,
  hints?: { fileName?: string | null; fileUrl?: string | null; fallback?: SecureMediaKind },
): SecureMediaKind {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "video" || value === "image" || value === "pdf" || value === "notes" || value === "other") {
    return value;
  }
  if (value === "doc" || value === "document" || value === "link") return "notes";
  if (value === "img" || value === "photo" || value === "picture") return "image";

  const name = `${hints?.fileName || ""} ${hints?.fileUrl || ""}`.toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v)(?:$|\?)/i.test(name)) return "video";
  if (/\.(png|jpe?g|gif|webp|avif|svg)(?:$|\?)/i.test(name)) return "image";
  if (/\.pdf(?:$|\?)/i.test(name)) return "pdf";
  if (/\.(docx?|txt|md|rtf)(?:$|\?)/i.test(name)) return "notes";

  return hints?.fallback || "other";
}

/**
 * Same-origin stream URL for native <video>/<img>/iframe.
 * Auth is the httpOnly session cookie only — never append tokens to the URL.
 */
export function resourceStreamSrc(resourceId: string): string {
  const apiPath = contentEndpoints.resourceStream(resourceId);
  return `/api/v1${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
}

/** API-relative path for fetch probes (no /api/v1 prefix). */
export function resourceStreamApiPath(resourceId: string): string {
  return contentEndpoints.resourceStream(resourceId);
}

/** Strip leftover `access_token` (or similar) query params from media URLs. */
export function stripMediaAuthQuery(url: string): string {
  if (!url) return url;
  try {
    const isRelative = url.startsWith("/");
    const parsed = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    parsed.searchParams.delete("access_token");
    parsed.searchParams.delete("token");
    parsed.searchParams.delete("auth");
    return isRelative ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.toString();
  } catch {
    return url;
  }
}

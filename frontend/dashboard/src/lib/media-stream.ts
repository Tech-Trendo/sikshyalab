/**
 * Authenticated media loading for /content/resources/<id>/stream/.
 *
 * Uses the httpOnly media cookie (credentials: "include") only — never puts
 * JWTs in the URL query string. Cross-origin HTTP may require same-site proxy
 * or HTTPS + SameSite=None for the cookie to be sent.
 */

import { resolveApiBase } from "@/lib/api-base";

function djangoOriginFromApiBase(): string {
  return resolveApiBase().replace(/\/api\/v1\/?$/, "");
}

/** Turn a stream_path or absolute URL into a fetchable absolute URL. */
export function absoluteStreamUrl(pathOrUrl: string): string {
  const trimmed = String(pathOrUrl || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    // Strip any leaked ?access_token= / ?token= before fetching.
    try {
      const u = new URL(trimmed);
      u.searchParams.delete("access_token");
      u.searchParams.delete("token");
      return u.toString();
    } catch {
      return trimmed;
    }
  }
  if (trimmed.startsWith("/")) {
    return `${djangoOriginFromApiBase()}${trimmed.split("?")[0]}`;
  }
  return trimmed;
}

export function resourceStreamUrl(resourceId: string | number): string {
  return absoluteStreamUrl(`/api/v1/content/resources/${resourceId}/stream/`);
}

/**
 * Fetch media bytes with the media-session cookie, then return an object URL
 * safe for <video src> / <img src> (no query tokens, no Authorization header).
 */
export async function fetchAuthorizedMediaObjectUrl(
  pathOrUrl: string,
): Promise<string | null> {
  const url = absoluteStreamUrl(pathOrUrl);
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return url || null;

  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

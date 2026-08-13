/**
 * Normalize Django media URLs for dashboard (localhost + LAN + remote FE).
 */
function djangoOrigin(): string {
  const fromEnv =
    (typeof import.meta !== "undefined" &&
      ((import.meta as any).env?.VITE_DJANGO_ORIGIN as string | undefined)) ||
    "";
  if (fromEnv.trim()) {
    try {
      const u = new URL(fromEnv.includes("://") ? fromEnv : `http://${fromEnv}`);
      if (u.port === "8081" || u.port === "5173") {
        return `${u.protocol}//${u.hostname}:8000`;
      }
      return u.origin;
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${protocol}//${hostname}:8000`;
    }
  }
  return "http://127.0.0.1:8000";
}

const MEDIA_KEY_PREFIXES = [
  "cms/",
  "courses/",
  "seo/",
  "certificates/",
  "avatars/",
  "profile_images/",
  "content/",
  "enrollments/",
  "assignments/",
  "students/",
  "teachers/",
  "receipts/",
];

/** Rewrite signed S3 URLs to Django `/media/<key>` (do not mutate SigV4 query strings). */
function s3ObjectUrlToMediaPath(absoluteUrl: string): string | null {
  try {
    const parsed = new URL(absoluteUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (!segments.length) return null;
    const isSigned = [...parsed.searchParams.keys()].some((k) =>
      k.startsWith("X-Amz-"),
    );
    const looksLikeObjectStore =
      isSigned ||
      /s3|datahub|amazonaws|minio|digitaloceanspaces/i.test(parsed.hostname);
    if (!looksLikeObjectStore) return null;
    for (let i = 0; i < segments.length; i++) {
      const rest = segments.slice(i).join("/");
      if (MEDIA_KEY_PREFIXES.some((p) => rest.startsWith(p))) {
        return `/media/${rest}`;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;

  let path = trimmed;
  if (!trimmed.startsWith("/")) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.pathname.startsWith("/media/")) {
        const fromS3 = s3ObjectUrlToMediaPath(trimmed);
        if (fromS3) path = fromS3;
        else return trimmed;
      } else {
        path = `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return trimmed;
    }
  }
  if (!path.startsWith("/media/")) return trimmed;

  const api =
    (typeof import.meta !== "undefined" &&
      ((import.meta as any).env?.VITE_API_URL as string | undefined)) ||
    "";
  if (api.startsWith("http")) {
    return `${djangoOrigin()}${path}`;
  }
  return path;
}

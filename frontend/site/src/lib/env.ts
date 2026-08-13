/**
 * Site env helpers — localhost + LAN + frontend-on-another-device.
 * Configure via site/.env (see .env.example).
 */

const API_PREFIX = "/api/v1";

function readEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env[name];
  return v?.trim() || undefined;
}

/** Django machine origin, e.g. http://192.168.100.154:8000 */
export function djangoOrigin(): string {
  const explicit = readEnv("NEXT_PUBLIC_DJANGO_ORIGIN") || readEnv("API_PROXY_TARGET");
  if (explicit) {
    try {
      const u = new URL(explicit.includes("://") ? explicit : `http://${explicit}`);
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

/** Ensure any configured base ends with /api/v1 (never bare /api). */
function normalizeApiBase(raw?: string | null): string {
  if (!raw?.trim()) return API_PREFIX;
  let value = raw.trim().replace(/\/$/, "");

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      let path = url.pathname.replace(/\/$/, "") || "";
      if (!path || path === "/" || path === "/api") {
        return `${url.origin}${API_PREFIX}`;
      }
      if (path.endsWith("/api")) {
        return `${url.origin}${API_PREFIX}`;
      }
      if (!path.includes("/api/v1")) {
        if (path.includes("/api/")) {
          path = path.replace(/\/api(\/|$)/, "/api/v1$1");
          return `${url.origin}${path}`.replace(/\/$/, "");
        }
        return `${url.origin}${API_PREFIX}`;
      }
      return `${url.origin}${path}`;
    } catch {
      return API_PREFIX;
    }
  }

  if (!value.startsWith("/")) value = `/${value}`;
  if (value === "/api") return API_PREFIX;
  if (!value.includes("/api/v1")) {
    if (value.startsWith("/api/")) return value.replace(/^\/api\//, "/api/v1/");
    return API_PREFIX;
  }
  return value;
}

/**
 * Browser: same-origin `/api/v1` (Next rewrite → Django) by default.
 * Set NEXT_PUBLIC_API_URL=http://<django-ip>:8000/api/v1 to call Django directly.
 */
function apiBase(): string {
  const fromNext = readEnv("NEXT_PUBLIC_API_URL");

  if (typeof window !== "undefined") {
    if (fromNext?.startsWith("http")) {
      return normalizeApiBase(fromNext);
    }
    return API_PREFIX;
  }

  if (fromNext?.startsWith("http")) {
    return normalizeApiBase(fromNext);
  }

  return `${djangoOrigin()}${API_PREFIX}`;
}

export function getDashboardUrl(): string {
  const fromNext = readEnv("NEXT_PUBLIC_DASHBOARD_URL");
  const lanHost = readEnv("NEXT_PUBLIC_LAN_HOST");

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

    // Explicit LAN host wins when page is opened on that host or env forces it
    if (lanHost && (hostname === lanHost || readEnv("NEXT_PUBLIC_FORCE_LAN") === "1")) {
      return `${protocol}//${lanHost}:5173`;
    }
    if (!isLocal) {
      return `${protocol}//${hostname}:5173`;
    }
    if (fromNext) return fromNext.replace(/\/$/, "");
    return `${protocol}//${hostname}:5173`;
  }

  if (fromNext) return fromNext.replace(/\/$/, "");
  if (lanHost) return `http://${lanHost}:5173`;
  return "http://localhost:5173";
}

export function getSiteUrl(): string {
  const fromNext = readEnv("NEXT_PUBLIC_SITE_URL");
  const lanHost = readEnv("NEXT_PUBLIC_LAN_HOST");
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    if (!isLocal) {
      const suffix = port ? `:${port}` : "";
      return `${protocol}//${hostname}${suffix}`;
    }
  }
  if (fromNext) return fromNext.replace(/\/$/, "");
  if (lanHost) return `http://${lanHost}:8081`;
  return "http://localhost:8081";
}

/** Django fallback when a media file is missing on disk/S3 — not a real asset. */
const DJANGO_MISSING_PLACEHOLDER = /\/cms\/placeholders\/missing\.png(?:$|\?)/i;

function isLocalOrLanHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local") ||
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^10\.\d+\.\d+\.\d+$/.test(hostname)
  );
}

/**
 * Turn Django media URLs into loadable absolute URLs.
 *
 * Important: next/image resolves relative `/media/...` against `public/` and does
 * NOT follow Next rewrites. Proxied `/media` works for plain <img>, but
 * `/_next/image?url=/media/...` returns 400. Always return an absolute Django
 * origin URL so the optimizer (and remotePatterns) can fetch the file.
 *
 * External CDN/S3 hosts are left unchanged.
 */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;

  if (!trimmed.startsWith("/")) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.pathname.startsWith("/media/")) return trimmed;
      if (DJANGO_MISSING_PLACEHOLDER.test(parsed.pathname)) return null;
      // S3 / CloudFront / public CDN — do not rewrite to Django
      if (!isLocalOrLanHostname(parsed.hostname)) return trimmed;
      return `${djangoOrigin()}${parsed.pathname}${parsed.search}`;
    } catch {
      return trimmed;
    }
  }

  if (!trimmed.startsWith("/media/")) return trimmed;
  if (DJANGO_MISSING_PLACEHOLDER.test(trimmed)) return null;

  return `${djangoOrigin()}${trimmed}`;
}

/** True when next/image should skip optimization (proxied media, remote, SVG). */
export function shouldUnoptimizeImageSrc(src: string): boolean {
  return /^https?:\/\//i.test(src) || /(?:^|\/)media\//.test(src) || /\.svg(?:$|\?)/i.test(src);
}

export { apiBase, normalizeApiBase };

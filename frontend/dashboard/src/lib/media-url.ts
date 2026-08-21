import { resolveApiBase, resolveDjangoOrigin } from "./api-base";

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]"
  );
}

/** Django origin from the same env var as API calls (`VITE_API_URL` / `VITE_DJANGO_ORIGIN`). */
export function djangoOrigin(): string {
  try {
    return resolveDjangoOrigin();
  } catch {
    try {
      return new URL(resolveApiBase()).origin;
    } catch {
      return "http://127.0.0.1:8000";
    }
  }
}

export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;

  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;

  const origin = djangoOrigin();

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname.startsWith("/media/") && isLoopbackHostname(parsed.hostname)) {
        return `${origin}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      /* keep original */
    }
    return trimmed;
  }

  if (trimmed.startsWith("/media/")) {
    return `${origin.replace(/\/$/, "")}${trimmed}`;
  }

  return trimmed;
}

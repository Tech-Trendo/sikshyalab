/**
 * Public marketing site URLs used by the dashboard app.
 */

function lanHost(): string | undefined {
  const h = import.meta.env.VITE_LAN_HOST as string | undefined;
  return h?.trim() || undefined;
}

export function getWebUrl(): string {
  const fromEnv = import.meta.env.VITE_WEB_URL as string | undefined;
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    const lan = lanHost();
    if (lan && (hostname === lan || !isLocal)) {
      // Prefer same host as dashboard when on LAN; else configured LAN site host
      if (!isLocal) return `${protocol}//${hostname}:8081`;
      return `${protocol}//${lan}:8081`;
    }
    if (!isLocal) {
      return `${protocol}//${hostname}:8081`;
    }
  }
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8081`;
  }
  return "http://localhost:8081";
}

/** Canonical sign-in page — only the public site login form is used. */
export function getWebLoginUrl(nextPath?: string): string {
  const base = `${getWebUrl()}/login`;
  if (!nextPath) return base;
  const qs = new URLSearchParams({ next: nextPath });
  return `${base}?${qs.toString()}`;
}

export function redirectToWebLogin(nextPath?: string) {
  if (typeof window === "undefined") return;
  window.location.replace(getWebLoginUrl(nextPath));
}

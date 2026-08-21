/**
 * Public marketing site URLs used by the dashboard app.
 */

function lanHost(): string | undefined {
  const h = import.meta.env.VITE_LAN_HOST as string | undefined;
  return h?.trim() || undefined;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function getWebUrl(): string {
  const fromEnv = (import.meta.env.VITE_WEB_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const lan = lanHost();
    const isLocal = isLoopbackHost(hostname);
    const isLan = Boolean(lan && hostname === lan);

    if (!isLocal && !isLan) {
      // dash.shikshalab.com → https://shikshalab.com
      if (hostname.startsWith("dash.")) {
        return `${protocol}//${hostname.slice("dash.".length)}`;
      }
      return `${protocol}//${hostname}`;
    }

    if (lan) return `${protocol}//${lan}:8081`;
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

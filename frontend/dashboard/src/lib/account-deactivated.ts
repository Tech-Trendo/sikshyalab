/**
 * Handle student account deactivation responses (HTTP 403).
 * Clears local session and sends the user to the public login page.
 */

export const DEACTIVATED_ACCOUNT_MESSAGE =
  "Your account has been deactivated. Please contact the administrator.";

const AUTH_STORAGE_KEY = "shikshalab_auth";
const ACCESS_KEY = "shikshalab_access_token";
const REFRESH_KEY = "shikshalab_refresh_token";

function clearLocalSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem("access_token");
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function collectMessages(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const b = body as Record<string, unknown>;
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
    else if (Array.isArray(v)) v.forEach(push);
  };
  push(b.message);
  push(b.detail);
  if (b.errors != null) {
    if (Array.isArray(b.errors)) push(b.errors);
    else if (typeof b.errors === "object") {
      for (const v of Object.values(b.errors as Record<string, unknown>)) push(v);
    }
  }
  return out;
}

export function isAccountDeactivatedHttp(status: number, body: unknown): boolean {
  if (status !== 403) return false;
  const joined = collectMessages(body).join(" ");
  return /deactivat|inactive|administrator/i.test(joined);
}

export function deactivationMessageFromBody(body: unknown): string {
  const parts = collectMessages(body);
  const exact = parts.find((p) => /deactivat/i.test(p));
  return exact || DEACTIVATED_ACCOUNT_MESSAGE;
}

function publicLoginUrl(): string {
  const fromEnv = (import.meta.env.VITE_WEB_URL as string | undefined)?.trim();
  if (fromEnv) return `${fromEnv.replace(/\/$/, "")}/login?deactivated=1`;
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8081/login?deactivated=1`;
  }
  return "http://localhost:8081/login?deactivated=1";
}

/**
 * Clear tokens + local user and redirect to site login.
 * Returns true so callers can abort further handling.
 */
export function handleDeactivatedHttpResponse(status: number, body: unknown): boolean {
  if (!isAccountDeactivatedHttp(status, body)) return false;
  clearLocalSession();
  if (typeof window !== "undefined") {
    window.location.replace(publicLoginUrl());
  }
  return true;
}

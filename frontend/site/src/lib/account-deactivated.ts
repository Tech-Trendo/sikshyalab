/**
 * Handle student account deactivation responses (HTTP 403) on the public site.
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
  if (Array.isArray(b.non_field_errors)) push(b.non_field_errors);
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

/** Map login failure body (+ optional status) → toast text. */
export function resolveLoginFailureMessage(body: unknown, status?: number): string {
  const parts = collectMessages(body);
  const joined = parts.join(" ");
  if (status === 403 || /deactivat|inactive/i.test(joined)) {
    return deactivationMessageFromBody(body);
  }
  const specific = parts.find(
    (p) => !/^validation failed$/i.test(p) && !/^an error occurred$/i.test(p),
  );
  return specific || "Invalid email or password";
}

/**
 * Clear session and send user to login. Returns true if handled.
 */
export function handleDeactivatedHttpResponse(status: number, body: unknown): boolean {
  if (!isAccountDeactivatedHttp(status, body)) return false;
  clearLocalSession();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.replace("/login?deactivated=1");
  }
  return true;
}

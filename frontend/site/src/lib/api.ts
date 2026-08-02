/**
 * API helpers for auth, profile, settings, notifications, dashboard.
 * Falls back silently when backend/JWT is unavailable.
 */

import { normalizeApiRole } from "@/lib/auth-routes";
import { apiBase } from "@/lib/env";

const ACCESS_KEY = "shikshalab_access_token";
const REFRESH_KEY = "shikshalab_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY) || localStorage.getItem("access_token");
}

export function setTokens(access: string, refresh?: string) {
  localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem("access_token");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

/** True when JWT is missing/malformed or past exp (with small skew). */
export function isAccessTokenExpired(token?: string | null, skewSeconds = 60): boolean {
  const raw = token ?? getAccessToken();
  if (!raw) return true;
  try {
    const part = raw.split(".")[1];
    if (!part) return true;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    if (!payload.exp) return true;
    return Date.now() / 1000 >= payload.exp - skewSeconds;
  } catch {
    return true;
  }
}

/**
 * Ensure a non-expired access token is in localStorage.
 * Refreshes when expired; clears session when refresh is impossible.
 */
export async function ensureAccessToken(): Promise<string | null> {
  const access = getAccessToken();
  if (access && !isAccessTokenExpired(access)) return access;
  if (!getRefreshToken()) {
    if (access) clearTokens();
    return null;
  }
  return refreshAccessToken();
}

let refreshInFlight: Promise<string | null> | null = null;

/** Refresh JWT access token; returns new access or null (clears session on failure). */
export async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearTokens();
    return null;
  }
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${apiBase()}/accounts/auth/token/refresh/`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) {
        clearTokens();
        return null;
      }
      const body = await parseJson(res);
      const data = unwrapData<{ access?: string; refresh?: string }>(body) || body;
      if (!data?.access) {
        clearTokens();
        return null;
      }
      setTokens(data.access, data.refresh || refresh);
      return data.access as string;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Create a short-lived cross-app login handoff code (site → dashboard). */
export async function createLoginHandoff(): Promise<string | null> {
  const access = await ensureAccessToken();
  const refresh = getRefreshToken();
  if (!access || !refresh) return null;
  try {
    const res = await fetch(`${apiBase()}/accounts/auth/handoff/`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${access}`,
      },
      body: JSON.stringify({ access, refresh }),
    });
    if (!res.ok) return null;
    const body = await parseJson(res);
    const data = unwrapData<{ code?: string }>(body) || body;
    return data?.code || null;
  } catch {
    return null;
  }
}

async function parseJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function unwrapData<T>(body: any): T | null {
  if (!body || typeof body !== "object") return null;
  if ("data" in body && body.data !== undefined) return body.data as T;
  return body as T;
}

export type ApiUser = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  role: string;
  phone?: string | null;
  avatar?: string | null;
  avatar_url?: string;
  avatar_display?: string;
  title?: string;
  bio?: string;
  location?: string;
  must_change_password?: boolean;
  profile?: {
    title?: string;
    bio?: string;
    city?: string;
    country?: string;
    location?: string;
  };
};

export type ApiSettings = {
  language: "en" | "ne" | "hi";
  timezone: string;
  compact_sidebar: boolean;
  marketing_emails: boolean;
  digest_weekly: boolean;
  assignment_alerts: boolean;
  fee_reminders: boolean;
  email_notifications: boolean;
  sms_notifications?: boolean;
  in_app_notifications?: boolean;
};

export type ApiNotification = {
  id: number | string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  action_url?: string;
  link?: string;
  created_at: string;
};

async function apiFetch(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    const buildHeaders = (token: string | null): HeadersInit => {
      const h: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (init?.headers) {
        new Headers(init.headers).forEach((value, key) => {
          if (key.toLowerCase() === "authorization") return;
          h[key] = value;
        });
      }
      if (token) h.Authorization = `Bearer ${token}`;
      // Allow callers to omit JSON content-type for FormData
      if (init?.body instanceof FormData) {
        delete h["Content-Type"];
      }
      return h;
    };

    let token = await ensureAccessToken();
    // Guests: skip authenticated endpoints entirely (avoids noisy 401s in Django logs)
    if (!token) {
      const isAuthPath =
        path.includes("/auth/profile") ||
        path.includes("/auth/settings") ||
        path.includes("/auth/handoff") ||
        path.includes("/auth/change-password") ||
        path.includes("/auth/logout");
      if (isAuthPath) return null;
    }

    let res = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: buildHeaders(token),
    });
    if (res.status === 401) {
      token = await refreshAccessToken();
      if (!token) return res;
      res = await fetch(`${apiBase()}${path}`, {
        ...init,
        headers: buildHeaders(token),
      });
    }
    return res;
  } catch {
    return null;
  }
}

export async function apiLogin(email: string, password: string): Promise<{
  user: ApiUser;
  tokens: { access: string; refresh: string };
  must_change_password?: boolean;
} | null> {
  // Fresh login — don't send a stale Bearer token (confuses logs / edge cases)
  clearTokens();
  const res = await fetch(`${apiBase()}/accounts/auth/login/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  if (!res || !res.ok) return null;
  const body = await parseJson(res);
  const data = (unwrapData<{
    user: ApiUser;
    tokens: { access: string; refresh: string };
    must_change_password?: boolean;
  }>(body) || body) as {
    user?: ApiUser;
    tokens?: { access?: string; refresh?: string };
    must_change_password?: boolean;
  };
  if (!data?.user || !data?.tokens?.access) return null;
  setTokens(data.tokens.access, data.tokens.refresh);
  const must =
    Boolean(data.must_change_password) || Boolean(data.user.must_change_password);
  return {
    user: { ...data.user, must_change_password: must },
    tokens: { access: data.tokens.access, refresh: data.tokens.refresh || "" },
    must_change_password: must,
  };
}

export async function apiForgotPassword(identifier: string): Promise<{
  ok: boolean;
  detail?: string;
  request_id?: string;
  expires_in_seconds?: number;
  channel?: string;
}> {
  const res = await apiFetch("/accounts/auth/forgot-password/", {
    method: "POST",
    body: JSON.stringify({ identifier }),
  });
  const body = res ? await parseJson(res) : null;
  if (!res || !res.ok) {
    return {
      ok: false,
      detail: (body && (body.detail || body.message)) || "Could not start password reset",
    };
  }
  return {
    ok: true,
    detail: body?.detail,
    request_id: body?.request_id,
    expires_in_seconds: body?.expires_in_seconds,
    channel: body?.channel,
  };
}

export async function apiVerifyPasswordOtp(
  request_id: string,
  otp: string,
): Promise<{ ok: boolean; detail?: string; reset_token?: string; expires_in_seconds?: number }> {
  const res = await apiFetch("/accounts/auth/verify-otp/", {
    method: "POST",
    body: JSON.stringify({ request_id, otp }),
  });
  const body = res ? await parseJson(res) : null;
  if (!res || !res.ok) {
    return {
      ok: false,
      detail: (body && (body.detail || body.message)) || "Invalid or expired code",
    };
  }
  return {
    ok: true,
    detail: body?.detail,
    reset_token: body?.reset_token,
    expires_in_seconds: body?.expires_in_seconds,
  };
}

export async function apiResendPasswordOtp(request_id: string): Promise<{
  ok: boolean;
  detail?: string;
  expires_in_seconds?: number;
}> {
  const res = await apiFetch("/accounts/auth/resend-otp/", {
    method: "POST",
    body: JSON.stringify({ request_id }),
  });
  const body = res ? await parseJson(res) : null;
  if (!res || !res.ok) {
    return {
      ok: false,
      detail: (body && (body.detail || body.message)) || "Could not resend code",
    };
  }
  return {
    ok: true,
    detail: body?.detail,
    expires_in_seconds: body?.expires_in_seconds,
  };
}

export async function apiResetPassword(
  token: string,
  new_password: string,
  new_password_confirm: string,
): Promise<{ ok: boolean; detail?: string }> {
  const res = await apiFetch("/accounts/auth/reset-password/", {
    method: "POST",
    body: JSON.stringify({ token, new_password, new_password_confirm }),
  });
  const body = res ? await parseJson(res) : null;
  if (!res || !res.ok) {
    return {
      ok: false,
      detail: (body && (body.detail || body.message)) || "Could not reset password",
    };
  }
  return { ok: true, detail: body?.detail };
}

export async function apiChangePassword(data: {
  old_password?: string;
  new_password: string;
  new_password_confirm: string;
}): Promise<{ ok: boolean; detail?: string }> {
  const res = await apiFetch("/accounts/auth/change-password/", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  const body = res ? await parseJson(res) : null;
  if (!res || !res.ok) {
    return {
      ok: false,
      detail: (body && (body.detail || body.message)) || "Could not change password",
    };
  }
  return { ok: true, detail: body?.detail };
}

export async function apiRegister(_data: {
  email: string;
  password: string;
  password_confirm: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: "STUDENT" | "TEACHER";
}): Promise<{ user: ApiUser; tokens: { access: string; refresh: string } } | null> {
  // Public registration is disabled on the API.
  return null;
}

export async function apiLogout(): Promise<void> {
  const refresh = typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null;
  if (refresh) {
    await apiFetch("/accounts/auth/logout/", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    });
  }
  clearTokens();
}

export async function fetchProfile(): Promise<ApiUser | null> {
  const token = await ensureAccessToken();
  if (!token) return null;
  const res = await apiFetch("/accounts/auth/profile/");
  if (!res) return null;
  if (res.status === 401) {
    clearTokens();
    return null;
  }
  if (!res.ok) return null;
  return unwrapData<ApiUser>(await parseJson(res));
}

export async function updateProfile(payload: Record<string, unknown>): Promise<ApiUser | null> {
  const res = await apiFetch("/accounts/auth/profile/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res || !res.ok) return null;
  return unwrapData<ApiUser>(await parseJson(res));
}

export async function fetchSettings(): Promise<ApiSettings | null> {
  const res = await apiFetch("/accounts/auth/settings/");
  if (!res || !res.ok) return null;
  return unwrapData<ApiSettings>(await parseJson(res));
}

export async function updateSettings(payload: Partial<ApiSettings>): Promise<ApiSettings | null> {
  const res = await apiFetch("/accounts/auth/settings/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res || !res.ok) return null;
  return unwrapData<ApiSettings>(await parseJson(res));
}

export async function changePassword(payload: {
  old_password: string;
  new_password: string;
  new_password_confirm: string;
}): Promise<{ ok: boolean; message?: string }> {
  const res = await apiFetch("/accounts/auth/change-password/", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res) return { ok: false, message: "Network error" };
  const body = await parseJson(res);
  if (!res.ok) {
    const msg =
      body?.detail ||
      body?.old_password?.[0] ||
      body?.new_password?.[0] ||
      body?.new_password_confirm?.[0] ||
      "Could not update password";
    return { ok: false, message: String(msg) };
  }
  return { ok: true, message: body?.detail || "Password updated" };
}

export async function fetchNotifications(): Promise<ApiNotification[] | null> {
  const res = await apiFetch("/notifications/");
  if (!res || !res.ok) return null;
  const body = await parseJson(res);
  const data = unwrapData<any>(body);
  if (Array.isArray(data)) return data as ApiNotification[];
  if (data && Array.isArray(data.results)) return data.results as ApiNotification[];
  return null;
}

export async function markNotificationRead(id: string | number): Promise<boolean> {
  const res = await apiFetch(`/notifications/${id}/mark_read/`, { method: "POST" });
  return !!(res && res.ok);
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const res = await apiFetch("/notifications/mark_all_read/", { method: "POST" });
  return !!(res && res.ok);
}

export async function deleteNotification(id: string | number): Promise<boolean> {
  const res = await apiFetch(`/notifications/${id}/`, { method: "DELETE" });
  return !!(res && (res.ok || res.status === 204));
}

export async function uploadCourseThumbnail(slug: string, file: File): Promise<string | null> {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const form = new FormData();
    form.append("thumbnail", file);
    const res = await fetch(`${apiBase()}/courses/courses/${slug}/upload-thumbnail/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) return null;
    const body = await parseJson(res);
    const data = unwrapData<any>(body) ?? body;
    return data?.thumbnail || data?.thumbnail_url || null;
  } catch {
    return null;
  }
}

export async function fetchDashboardOverview(): Promise<Record<string, unknown> | null> {
  const res = await apiFetch("/analytics/dashboard/");
  if (!res || !res.ok) return null;
  return unwrapData<Record<string, unknown>>(await parseJson(res));
}

/** Role-specific overview summary APIs (admin / teacher / student). */
export async function fetchRoleDashboardOverview(
  role: "admin" | "teacher" | "student",
): Promise<Record<string, unknown> | null> {
  const path =
    role === "admin"
      ? "/analytics/dashboard/admin/"
      : role === "teacher"
        ? "/analytics/dashboard/teacher/"
        : "/analytics/dashboard/student/";
  const res = await apiFetch(path);
  if (!res || !res.ok) return null;
  return unwrapData<Record<string, unknown>>(await parseJson(res));
}

export function mapApiUserToAuth(
  user: ApiUser,
  profile?: { studentId?: string; teacherName?: string },
) {
  const role = normalizeApiRole(user.role);
  const name =
    user.full_name ||
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.email;
  return {
    name,
    email: user.email,
    role,
    phone: user.phone || "",
    title: user.title || user.profile?.title || "",
    bio: user.bio || user.profile?.bio || "",
    location: user.location || user.profile?.location || "",
    avatar: user.avatar_display || user.avatar_url || (typeof user.avatar === "string" ? user.avatar : "") || undefined,
    teacherName: role === "teacher" ? (profile?.teacherName || name) : undefined,
    studentId: role === "student" ? profile?.studentId : undefined,
    mustChangePassword: Boolean(user.must_change_password),
  };
}

/** Resolve student_id / teacher name from profile endpoints after login. */
export async function fetchRoleProfileIds(
  _role: "admin" | "teacher" | "student",
): Promise<{ studentId?: string; teacherName?: string } | undefined> {
  // Full profile resolution lives in the dashboard app; web login only needs JWT handoff.
  return undefined;
}

export function mapApiSettings(s: ApiSettings) {
  const lang = s.language === "hi" ? "ne" : s.language;
  return {
    emailNotifications: s.email_notifications,
    assignmentAlerts: s.assignment_alerts,
    feeReminders: s.fee_reminders,
    marketingEmails: s.marketing_emails,
    digestWeekly: s.digest_weekly,
    language: lang as "en" | "ne",
    timezone: s.timezone,
    compactSidebar: s.compact_sidebar,
  };
}

export function toApiSettings(s: {
  emailNotifications: boolean;
  assignmentAlerts: boolean;
  feeReminders: boolean;
  marketingEmails: boolean;
  digestWeekly: boolean;
  language: "en" | "ne";
  timezone: string;
  compactSidebar: boolean;
}): Partial<ApiSettings> {
  return {
    email_notifications: s.emailNotifications,
    assignment_alerts: s.assignmentAlerts,
    fee_reminders: s.feeReminders,
    marketing_emails: s.marketingEmails,
    digest_weekly: s.digestWeekly,
    language: s.language,
    timezone: s.timezone,
    compact_sidebar: s.compactSidebar,
  };
}

const TYPE_KIND: Record<string, "info" | "success" | "warning" | "assignment" | "fee" | "system"> = {
  ASSIGNMENT: "assignment",
  PAYMENT: "fee",
  ENROLLMENT: "success",
  CERTIFICATE: "success",
  ATTENDANCE: "info",
  ANNOUNCEMENT: "info",
  SYSTEM: "system",
  ADMIN: "system",
};

export function mapApiNotification(n: ApiNotification) {
  return {
    id: String(n.id),
    title: n.title,
    body: n.message,
    href: n.action_url || n.link || undefined,
    kind: TYPE_KIND[n.notification_type] || ("info" as const),
    read: !!n.is_read,
    createdAt: n.created_at,
  };
}

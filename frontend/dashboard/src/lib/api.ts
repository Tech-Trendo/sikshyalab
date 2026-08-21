
import { normalizeApiRole } from "@/lib/auth-routes";
import { courseEndpoints } from "@/lib/api-endpoints";
import { resolveApiBase, resolveDjangoOrigin } from "@/lib/api-base";
import { resolveMediaUrl } from "@/lib/media-url";
import { handleDeactivatedHttpResponse } from "@/lib/account-deactivated";

const API_BASE = resolveApiBase();

const ACCESS_KEY = "shikshalab_access_token";
const REFRESH_KEY = "shikshalab_refresh_token";

export function setTokens(access: string, refresh?: string) {
  localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem("access_token");
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY) || localStorage.getItem("access_token");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

let refreshInFlight: Promise<string | null> | null = null;

/** Refresh JWT access token; returns new access token or null. */
export async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/accounts/auth/token/refresh/`, {
        method: "POST",
        credentials: "include",
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
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Authenticated fetch with one automatic token refresh on 401. */
export async function authedFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const buildHeaders = (token: string | null, extra?: HeadersInit): HeadersInit => {
    const h: Record<string, string> = { Accept: "application/json" };
    if (extra) {
      new Headers(extra).forEach((value, key) => {
        if (key.toLowerCase() === "authorization") return;
        h[key] = value;
      });
    }
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };

  try {
    let token = getAccessToken();
    let res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: buildHeaders(token, init?.headers),
    });
    if (res.status === 401) {
      token = await refreshAccessToken();
      if (!token) return res;
      res = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        ...init,
        headers: buildHeaders(token, init?.headers),
      });
    }
    return res;
  } catch {
    return null;
  }
}

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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

/** Prefer field-level API errors over the generic envelope "Validation failed". */
function formatApiError(body: any, fallback = "Request failed"): string {
  if (!body || typeof body !== "object") return fallback;
  const errors = body.errors;
  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    const parts: string[] = [];
    for (const [field, value] of Object.entries(errors)) {
      const text = Array.isArray(value) ? value.filter(Boolean).join(", ") : String(value || "");
      if (!text) continue;
      if (field === "detail" || field === "non_field_errors") parts.push(text);
      else parts.push(`${field}: ${text}`);
    }
    if (parts.length) return parts.join(" · ");
  }
  if (typeof body.detail === "string" && body.detail) return body.detail;
  if (typeof body.message === "string" && body.message && body.message !== "Validation failed") {
    return body.message;
  }
  if (typeof body.message === "string" && body.message) return body.message;
  return fallback;
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
  uuid?: string;
  title: string;
  message: string;
  notification_type: string;
  event_code?: string;
  channel?: string;
  priority?: string;
  status?: string;
  is_read: boolean;
  is_archived?: boolean;
  action_url?: string;
  link?: string;
  created_at: string;
};

async function apiFetch(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: { ...authHeaders(), ...(init?.headers || {}) },
    });
    if (res.status === 403) {
      const body = await res.clone().json().catch(() => null);
      if (handleDeactivatedHttpResponse(403, body)) return res;
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
  // Fresh login — don't send a stale Bearer token
  clearTokens();
  const res = await fetch(`${API_BASE}/accounts/auth/login/`, {
    method: "POST",
    credentials: "include",
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

export async function apiForgotPassword(email: string): Promise<boolean> {
  const res = await apiFetch("/accounts/auth/forgot-password/", {
    method: "POST",
    body: JSON.stringify({ identifier: email, email }),
  });
  return Boolean(res?.ok);
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

export async function apiAdminCreateUser(payload: {
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  create_profile?: boolean;
  send_email?: boolean;
  course?: string;
  batch?: string;
}): Promise<{
  ok: boolean;
  detail?: string;
  temporary_password?: string;
  email_sent?: boolean;
  email_error?: string;
  id?: number;
  email?: string;
  name?: string;
  phone?: string;
  role?: string;
  student_id?: string;
  course?: string | null;
  batch?: string | null;
  enrollment_id?: string | null;
  must_change_password?: boolean;
}> {
  const res = await apiFetch("/accounts/admin/create-user/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const body = res ? await parseJson(res) : null;
  const data = unwrapData<any>(body) || body;
  if (!res || !res.ok) {
    return {
      ok: false,
      detail: formatApiError(body, (data && (data.detail || data.message)) || "Could not create user"),
    };
  }
  return {
    ok: true,
    temporary_password: data?.temporary_password,
    email_sent: Boolean(data?.email_sent),
    email_error: data?.email_error || undefined,
    id: data?.id,
    email: data?.email,
    name: data?.name,
    phone: data?.phone,
    role: data?.role,
    student_id: data?.student_id,
    course: data?.course ?? null,
    batch: data?.batch ?? null,
    enrollment_id: data?.enrollment_id ?? null,
    must_change_password: Boolean(data?.must_change_password),
  };
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
  if (!getAccessToken()) return null;
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

/** Upload profile picture to Django media (avatars/). */
export async function uploadProfileAvatar(file: File): Promise<ApiUser | null> {
  try {
    const form = new FormData();
    form.append("avatar", file);
    const res = await authedFetch("/accounts/auth/profile/", {
      method: "PATCH",
      body: form,
      headers: { Accept: "application/json" },
    });
    if (!res || !res.ok) return null;
    return unwrapData<ApiUser>(await parseJson(res));
  } catch {
    return null;
  }
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

export async function fetchNotifications(params?: {
  search?: string;
  notification_type?: string;
  priority?: string;
  is_read?: boolean;
  include_archived?: boolean;
}): Promise<ApiNotification[] | null> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.notification_type) qs.set("notification_type", params.notification_type);
  if (params?.priority) qs.set("priority", params.priority);
  if (typeof params?.is_read === "boolean") qs.set("is_read", String(params.is_read));
  if (params?.include_archived) qs.set("include_archived", "1");
  const suffix = qs.toString() ? `?${qs}` : "";
  const res = await apiFetch(`/notifications/${suffix}`);
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

export async function archiveNotification(id: string | number): Promise<boolean> {
  const res = await apiFetch(`/notifications/${id}/archive/`, { method: "POST" });
  return !!(res && res.ok);
}

export async function deleteNotification(id: string | number): Promise<boolean> {
  const res = await apiFetch(`/notifications/${id}/`, { method: "DELETE" });
  return !!(res && (res.ok || res.status === 204));
}

export async function fetchNotificationPreferences(): Promise<{
  email_enabled: boolean;
  in_app_enabled: boolean;
  browser_enabled: boolean;
  sms_enabled: boolean;
  digest_daily: boolean;
  digest_weekly: boolean;
  preferences: Record<string, unknown>;
} | null> {
  const res = await apiFetch("/notifications/preferences/me/");
  if (!res || !res.ok) return null;
  return unwrapData(await parseJson(res));
}

export async function updateNotificationPreferences(
  data: Partial<{
    email_enabled: boolean;
    in_app_enabled: boolean;
    browser_enabled: boolean;
    sms_enabled: boolean;
    digest_daily: boolean;
    digest_weekly: boolean;
    preferences: Record<string, unknown>;
  }>,
): Promise<boolean> {
  const res = await apiFetch("/notifications/preferences/me/", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return !!(res && res.ok);
}

export async function fetchNotificationAnalytics(days = 30): Promise<Record<string, unknown> | null> {
  const res = await apiFetch(`/notifications/analytics/?days=${days}`);
  if (!res || !res.ok) return null;
  return unwrapData(await parseJson(res));
}

export async function uploadCourseThumbnail(slug: string, file: File): Promise<string | null> {
  const trimmed = (slug || "").trim();
  if (!trimmed) return null;
  try {
    const form = new FormData();
    form.append("thumbnail", file);
    const res = await authedFetch(courseEndpoints.uploadThumbnail(trimmed), {
      method: "POST",
      body: form,
      headers: { Accept: "application/json" },
    });
    if (!res || !res.ok) return null;
    const body = await parseJson(res);
    const data = unwrapData<any>(body) ?? body;
    return data?.thumbnail || data?.thumbnail_url || null;
  } catch {
    return null;
  }
}

/** Multipart PATCH of optional og_image on the course object. Omit unless the user picked a file. */
export async function uploadCourseOgImage(slug: string, file: File): Promise<string | null> {
  const trimmed = (slug || "").trim();
  if (!trimmed) return null;
  try {
    const form = new FormData();
    form.append("og_image", file);
    const res = await authedFetch(courseEndpoints.detail(trimmed), {
      method: "PATCH",
      body: form,
      headers: { Accept: "application/json" },
    });
    if (!res || !res.ok) return null;
    const body = await parseJson(res);
    const data = unwrapData<any>(body) ?? body;
    return data?.og_image || data?.og_image_url || null;
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
  const rawAvatar =
    user.avatar_display ||
    user.avatar_url ||
    (typeof user.avatar === "string" ? user.avatar : "") ||
    "";
  let avatar = rawAvatar || undefined;
  if (avatar) {
    avatar = resolveMediaUrl(avatar) || avatar;
  }
  return {
    name,
    email: user.email,
    role,
    phone: user.phone || "",
    title: user.title || user.profile?.title || "",
    bio: user.bio || user.profile?.bio || "",
    location: user.location || user.profile?.location || "",
    avatar,
    teacherName: role === "teacher" ? (profile?.teacherName || name) : undefined,
    studentId: role === "student" ? profile?.studentId : undefined,
    mustChangePassword: Boolean(user.must_change_password),
  };
}

/** Resolve student_id / teacher name from profile endpoints after login. */
export async function fetchRoleProfileIds(role: "admin" | "teacher" | "student") {
  if (role === "student") {
    const { fetchStudentProfileMe } = await import("./dashboard-api");
    const profile = await fetchStudentProfileMe();
    if (profile?.student_id) return { studentId: profile.student_id };
  }
  if (role === "teacher") {
    const { fetchTeacherProfileMe } = await import("./dashboard-api");
    const profile = await fetchTeacherProfileMe();
    if (profile?.full_name) return { teacherName: profile.full_name };
  }
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
  AUTH: "info",
  STUDENT: "info",
  COURSE: "info",
  BATCH: "info",
  EXAM: "warning",
  SECURITY: "warning",
};

export function mapApiNotification(n: ApiNotification) {
  return {
    id: String(n.id),
    title: n.title,
    body: n.message,
    href: n.action_url || n.link || undefined,
    kind: TYPE_KIND[n.notification_type] || ("info" as const),
    read: !!n.is_read,
    archived: !!n.is_archived,
    priority: (n.priority || "MEDIUM").toLowerCase() as
      | "critical"
      | "high"
      | "medium"
      | "low",
    category: n.notification_type || "SYSTEM",
    eventCode: n.event_code || "",
    createdAt: n.created_at,
  };
}

export function resolveNotificationsWsUrl(accessToken: string): string | null {
  const env = (import.meta as {
    env?: { VITE_WS_URL?: string; VITE_DJANGO_ORIGIN?: string; VITE_API_URL?: string };
  }).env;
  const explicit = env?.VITE_WS_URL?.trim();
  let base = explicit;

  if (!base) {
    try {
      const origin = resolveDjangoOrigin();
      const u = new URL(origin);
      u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
      u.pathname = "/ws/notifications/";
      u.search = "";
      base = u.toString();
    } catch {
      return null;
    }
  } else {
    // Pages served over HTTPS must use wss:// even if env still says ws://
    try {
      const u = new URL(base);
      if (
        (typeof window !== "undefined" && window.location.protocol === "https:") ||
        u.protocol === "https:"
      ) {
        if (u.protocol === "ws:" || u.protocol === "http:") {
          u.protocol = "wss:";
        }
      }
      base = u.toString();
    } catch {
      return null;
    }
  }

  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}token=${encodeURIComponent(accessToken)}`;
}

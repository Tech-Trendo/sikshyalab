/**
 * Course content API — chapters & parts CRUD.
 */

import { getAccessToken } from "./api";

import { resolveApiBase } from "./api-base";

const API_BASE = resolveApiBase();

async function parseBody<T>(res: Response): Promise<T | null> {
  try {
    const body = await res.json();
    if (body && typeof body === "object" && "data" in body) return body.data as T;
    return body as T;
  } catch {
    return null;
  }
}

function authHeaders(json = true): HeadersInit {
  const token = getAccessToken();
  const h: HeadersInit = { Accept: "application/json" };
  if (json) h["Content-Type"] = "application/json";
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function mutate<T>(path: string, method: string, body?: unknown): Promise<{ ok: boolean; data: T | null; detail?: string }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: authHeaders(body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await parseBody<T>(res);
    if (!res.ok) {
      const detail =
        data && typeof data === "object" && "detail" in (data as object)
          ? String((data as { detail?: unknown }).detail)
          : `Request failed (${res.status})`;
      return { ok: false, data: null, detail };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, data: null, detail: "Network error" };
  }
}

export type ContentChapter = {
  id: string;
  course: string;
  title: string;
  slug?: string;
  order?: number;
  is_published?: boolean;
};

export type ContentPart = {
  id: string;
  chapter: string;
  title: string;
  slug?: string;
  content_type?: string;
  video_url?: string;
  notes?: string;
  description?: string;
  order?: number;
  is_published?: boolean;
  estimated_minutes?: number;
};

function mapPartTypeToApi(type: "video" | "pdf" | "notes"): string {
  if (type === "video") return "VIDEO";
  if (type === "pdf") return "PDF";
  return "NOTES";
}

export const contentApi = {
  createChapter: (payload: {
    course: string;
    title: string;
    order?: number;
    is_published?: boolean;
  }) =>
    mutate<ContentChapter>("/content/chapters/", "POST", {
      is_published: true,
      order: payload.order ?? 0,
      ...payload,
    }),

  updateChapter: (id: string, payload: Partial<{ title: string; order: number; is_published: boolean }>) =>
    mutate<ContentChapter>(`/content/chapters/${id}/`, "PATCH", payload),

  deleteChapter: (id: string) => mutate<void>(`/content/chapters/${id}/`, "DELETE"),

  createPart: (payload: {
    chapter: string;
    title: string;
    type?: "video" | "pdf" | "notes";
    video_url?: string;
    notes?: string;
    description?: string;
    order?: number;
    is_published?: boolean;
  }) =>
    mutate<ContentPart>("/content/parts/", "POST", {
      chapter: payload.chapter,
      title: payload.title,
      content_type: mapPartTypeToApi(payload.type || "video"),
      video_url: payload.video_url || "",
      notes: payload.notes || "",
      description: payload.description || "",
      order: payload.order ?? 0,
      is_published: payload.is_published ?? true,
    }),

  updatePart: (
    id: string,
    payload: Partial<{
      title: string;
      content_type: string;
      video_url: string;
      notes: string;
      description: string;
      order: number;
      is_published: boolean;
      type: "video" | "pdf" | "notes";
    }>,
  ) => {
    const body: Record<string, unknown> = { ...payload };
    if (payload.type) {
      body.content_type = mapPartTypeToApi(payload.type);
      delete body.type;
    }
    return mutate<ContentPart>(`/content/parts/${id}/`, "PATCH", body);
  },

  deletePart: (id: string) => mutate<void>(`/content/parts/${id}/`, "DELETE"),
};

/**
 * Course content API — chapters & parts CRUD.
 */

import { authedFetch, getAccessToken } from "./api";

import { resolveApiBase } from "./api-base";
import { contentEndpoints } from "./api-endpoints";
import {
  normalizeVideoTimestamp,
  normalizeVideoTimestampList,
  type VideoTimestamp,
} from "./video-timestamps";
import type { SecureMediaKind } from "./signed-media";

export type { SecureMediaKind };

const API_BASE = resolveApiBase();

async function parseBody<T>(res: Response): Promise<T | null> {
  try {
    const body = await res.json();
    // Only unwrap the standard envelope { success, message, data }.
    // A bare DRF object that happens to have a `data` field must not be unwrapped.
    if (body && typeof body === "object" && "data" in body && ("success" in body || "message" in body)) {
      return body.data as T;
    }
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
      credentials: "include",
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

export type PartResource = {
  id: string;
  part: string;
  title: string;
  resource_type: "PDF" | "DOC" | "LINK" | "VIDEO" | "OTHER";
  file: string | null;
  external_url: string;
  order?: number;
  created_at: string;
  updated_at: string;
  timestamps?: VideoTimestamp[] | unknown[];
};

function mapResourceType(type: "video" | "notes" | "pdf" | "other"): PartResource["resource_type"] {
  if (type === "pdf") return "PDF";
  if (type === "notes") return "DOC";
  if (type === "video") return "VIDEO";
  return "OTHER";
}

async function multipartMutate<T>(path: string, method: string, form?: FormData): Promise<{ ok: boolean; data: T | null; detail?: string }> {
  try {
    const res = await authedFetch(path, {
      method,
      body: form,
      // Do not set Content-Type: the browser adds the multipart boundary.
      headers: { Accept: "application/json" },
    });
    if (!res) return { ok: false, data: null, detail: "Network error" };
    const data = await parseBody<T>(res);
    if (!res.ok) {
      const detail =
        data && typeof data === "object" && "detail" in (data as object)
          ? String((data as { detail?: unknown }).detail)
          : data && typeof data === "object" && "message" in (data as object)
            ? String((data as { message?: unknown }).message)
            : `Request failed (${res.status})`;
      return { ok: false, data: null, detail };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, data: null, detail: "Network error" };
  }
}

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

  uploadPartResource: (payload: { part: string; title: string; type: "video" | "notes" | "pdf" | "other"; file: File }) => {
    const form = new FormData();
    form.append("part", payload.part);
    form.append("title", payload.title);
    form.append("resource_type", mapResourceType(payload.type));
    form.append("file", payload.file);
    return multipartMutate<PartResource>(contentEndpoints.resources(), "POST", form);
  },

  deletePartResource: (id: string) => multipartMutate<void>(contentEndpoints.resourceDetail(id), "DELETE"),

  /**
   * Probe the stream endpoint with cookie credentials only (no token in URL / no Bearer).
   * Used to surface session-expired UI before mounting media elements.
   */
  probeResourceStream: async (
    resourceId: string,
  ): Promise<{ ok: boolean; unauthorized: boolean; detail?: string }> => {
    try {
      const path = `/api/v1${contentEndpoints.resourceStream(resourceId)}`;
      const res = await fetch(path, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "*/*", Range: "bytes=0-0" },
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, unauthorized: true, detail: "Session expired, please log in again" };
      }
      // 200 / 206 Partial Content are success for Range probes
      if (res.ok || res.status === 206) return { ok: true, unauthorized: false };
      return { ok: false, unauthorized: false, detail: `Stream unavailable (${res.status})` };
    } catch {
      return { ok: false, unauthorized: false, detail: "Network error" };
    }
  },

  listResourceTimestamps: async (resourceId: string): Promise<{ ok: boolean; data: VideoTimestamp[]; detail?: string }> => {
    try {
      const res = await authedFetch(contentEndpoints.resourceTimestamps(resourceId), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res) return { ok: false, data: [], detail: "Network error" };
      const data = await parseBody<unknown>(res);
      if (!res.ok) {
        return {
          ok: false,
          data: [],
          detail: `Request failed (${res.status})`,
        };
      }
      return { ok: true, data: normalizeVideoTimestampList(data) };
    } catch {
      return { ok: false, data: [], detail: "Network error" };
    }
  },

  createResourceTimestamp: async (
    resourceId: string,
    payload: { time_seconds: number; label: string },
  ): Promise<{ ok: boolean; data: VideoTimestamp | null; detail?: string }> => {
    const result = await mutate<unknown>(contentEndpoints.resourceTimestamps(resourceId), "POST", {
      time_seconds: Math.max(0, Math.floor(payload.time_seconds)),
      label: payload.label.trim(),
    });
    if (!result.ok) return { ok: false, data: null, detail: result.detail };
    return { ok: true, data: normalizeVideoTimestamp(result.data) };
  },

  deleteResourceTimestamp: (resourceId: string, timestampId: string) =>
    mutate<void>(contentEndpoints.resourceTimestampDetail(resourceId, timestampId), "DELETE"),
};

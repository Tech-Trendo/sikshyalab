/**
 * Shared HTTP client for ShikshaLab API (Django REST Framework).
 * Parses the backend envelope: { success, message, data, errors }.
 */

export type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[] | string> | string[];
};

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: ApiEnvelope<unknown>["errors"];

  constructor(message: string, status: number, errors?: ApiEnvelope<unknown>["errors"]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }

  static isUnauthorized(err: unknown): boolean {
    return err instanceof ApiError && err.status === 401;
  }

  static fieldMessages(err: unknown): string {
    if (!(err instanceof ApiError) || !err.errors) return err instanceof Error ? err.message : "Request failed";
    if (Array.isArray(err.errors)) return err.errors.join(", ");
    return Object.entries(err.errors)
      .flatMap(([k, v]) => (Array.isArray(v) ? v.map((m) => `${k}: ${m}`) : [`${k}: ${v}`]))
      .join("; ");
  }
}

export function getApiBase(): string {
  return (
    (typeof import.meta !== "undefined" && (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env
      ?.VITE_API_URL) || "/api/v1"
  );
}

export function unwrapEnvelope<T>(body: unknown): T | null {
  if (!body || typeof body !== "object") return null;
  const envelope = body as ApiEnvelope<T>;
  if ("data" in envelope && envelope.data !== undefined) return envelope.data;
  return body as T;
}

export async function parseResponseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export type HttpRequestOptions = RequestInit & {
  /** When true, throws ApiError on non-2xx instead of returning null */
  throwOnError?: boolean;
};

export async function httpRequest<T>(
  path: string,
  init: HttpRequestOptions = {},
  getHeaders?: () => HeadersInit,
): Promise<T | null> {
  const { throwOnError = false, ...fetchInit } = init;
  const url = path.startsWith("http") ? path : `${getApiBase()}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...fetchInit,
      headers: {
        Accept: "application/json",
        ...(fetchInit.body ? { "Content-Type": "application/json" } : {}),
        ...(getHeaders?.() || {}),
        ...(fetchInit.headers || {}),
      },
    });
  } catch (err) {
    if (throwOnError) {
      throw new ApiError(err instanceof Error ? err.message : "Network error", 0);
    }
    return null;
  }

  const body = await parseResponseBody(res);

  if (!res.ok) {
    const envelope = body as ApiEnvelope<unknown> | null;
    const message =
      envelope?.message ||
      (typeof envelope?.errors === "string" ? envelope.errors : undefined) ||
      res.statusText ||
      "Request failed";
    if (throwOnError) {
      throw new ApiError(message, res.status, envelope?.errors);
    }
    return null;
  }

  return unwrapEnvelope<T>(body);
}

/** Opt-in mock/demo data only — never default on in development. */
export function allowMockFallback(): boolean {
  if (typeof import.meta === "undefined") return false;
  const env = (import.meta as ImportMeta & { env?: { VITE_ALLOW_MOCK?: string } }).env;
  return env?.VITE_ALLOW_MOCK === "true";
}

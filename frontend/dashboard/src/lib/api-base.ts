

const LOCAL_API_FALLBACK = "http://127.0.0.1:8000/api/v1";
const LOCAL_ORIGIN_FALLBACK = "http://127.0.0.1:8000";

export function resolveDjangoOrigin(): string {
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta as {
          env?: { VITE_API_URL?: string; VITE_DJANGO_ORIGIN?: string };
        }).env
      : undefined;
  const raw = (env?.VITE_DJANGO_ORIGIN || env?.VITE_API_URL || LOCAL_ORIGIN_FALLBACK).replace(
    /\/$/,
    "",
  );
  try {
    return new URL(raw.includes("://") ? raw : `http://${raw}`).origin;
  } catch {
    return LOCAL_ORIGIN_FALLBACK;
  }
}

export function resolveApiBase(): string {
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta as {
          env?: { VITE_API_URL?: string; VITE_DJANGO_ORIGIN?: string };
        }).env
      : undefined;
  const fromEnv = env?.VITE_API_URL?.trim();
  if (fromEnv?.startsWith("http")) {
    return fromEnv.replace(/\/$/, "");
  }
  try {
    return `${resolveDjangoOrigin()}/api/v1`;
  } catch {
    return LOCAL_API_FALLBACK;
  }
}

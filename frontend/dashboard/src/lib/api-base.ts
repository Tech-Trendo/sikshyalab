/**
 * Resolve the Django API base URL.
 * Never fall back to relative `/api/v1` — Vite's proxy hangs with TanStack Start here.
 */
export function resolveApiBase(): string {
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta as { env?: { VITE_API_URL?: string; VITE_DJANGO_ORIGIN?: string } }).env
      : undefined;
  const fromEnv = env?.VITE_API_URL?.trim();
  if (fromEnv?.startsWith("http")) {
    return fromEnv.replace(/\/$/, "");
  }
  const origin = (env?.VITE_DJANGO_ORIGIN || env?.VITE_API_URL || "http://192.168.100.154:8000").replace(
    /\/$/,
    "",
  );
  try {
    return `${new URL(origin.includes("://") ? origin : `http://${origin}`).origin}/api/v1`;
  } catch {
    return "http://192.168.100.154:8000/api/v1";
  }
}

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { stripMediaAuthQuery } from "@/lib/signed-media";

GlobalWorkerOptions.workerSrc = pdfWorker;

export { getDocument };

/** Prefer same-origin `/media/...` or `/api/v1/...` so the Vite proxy handles auth/CORS. */
export function fetchablePdfUrl(src: string): string {
  try {
    const cleaned = stripMediaAuthQuery(src);
    const parsed = new URL(
      cleaned,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    if (parsed.pathname.startsWith("/media/") || parsed.pathname.startsWith("/api/v1/")) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    /* keep original */
  }
  return stripMediaAuthQuery(src);
}

/**
 * Fetch PDF bytes with credentials (httpOnly cookie). Never puts tokens in the URL.
 */
export async function fetchPdfArrayBuffer(src: string): Promise<ArrayBuffer> {
  const url = fetchablePdfUrl(src);
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/pdf,*/*" },
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error("Session expired, please log in again") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`);
  return res.arrayBuffer();
}

export function displayPdfFileName(fileName?: string | null, fallback = "Document.pdf"): string {
  const raw = (fileName || "").trim();
  if (!raw) return fallback;
  try {
    const path = raw.split("?")[0];
    const last = path.split("/").pop() || path;
    return decodeURIComponent(last) || fallback;
  } catch {
    return raw;
  }
}

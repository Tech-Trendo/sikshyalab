import { authedFetch } from "@/lib/api";
import { assignmentEndpoints } from "@/lib/api-endpoints";

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header) || /filename=([^;]+)/i.exec(header);
  if (plain?.[1]) return plain[1].trim().replace(/^"|"$/g, "");
  return fallback;
}

export async function downloadSubmissionAttachment(
  submissionId: string,
  fileName?: string,
): Promise<{ ok: boolean; error?: string }> {
  const id = String(submissionId || "").trim();
  if (!id) return { ok: false, error: "Submission id is missing." };

  const res = await authedFetch(assignmentEndpoints.submissionDownload(id), {
    method: "GET",
    headers: { Accept: "application/octet-stream, application/pdf, */*" },
  });

  if (!res) {
    return { ok: false, error: "Network error while downloading the file." };
  }
  if (res.status === 403) {
    return { ok: false, error: "You do not have permission to download this file." };
  }
  if (res.status === 404) {
    return { ok: false, error: "Submission file not found." };
  }
  if (!res.ok) {
    let detail = `Download failed (${res.status})`;
    try {
      const body = await res.clone().json();
      if (body && typeof body === "object") {
        const msg = (body as { message?: string; detail?: string }).message
          || (body as { detail?: string }).detail;
        if (typeof msg === "string" && msg.trim()) detail = msg.trim();
      }
    } catch {
      /* ignore parse errors */
    }
    return { ok: false, error: detail };
  }

  const blob = await res.blob();
  const name = filenameFromDisposition(
    res.headers.get("Content-Disposition"),
    fileName || "submission",
  );
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
  return { ok: true };
}

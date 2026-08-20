export const PAGE_SIZE = 10;

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: current,
    totalPages,
    total: items.length,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, items.length),
  };
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Build a branded PDF and download it. Table reports are built client-side so every row is included. */
export async function exportPdf(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  opts?: {
    filename?: string;
    apiUrl?: string;
    subtitle?: string;
    format?: "report" | "certificate";
    certificate?: import("./pdf-export").CertificatePdfData;
  },
): Promise<{ ok: boolean; error?: string }> {
  const filename = opts?.filename || `${slugify(title)}.pdf`;
  const isCertificate = opts?.format === "certificate" || Boolean(opts?.certificate);
  const { buildBrandedCertificatePdf, buildBrandedReportPdf, downloadPdfBytes } = await import("./pdf-export");

  try {
    if (!isCertificate) {
      const bytes = buildBrandedReportPdf(
        { title, subtitle: opts?.subtitle, generatedAt: new Date().toLocaleString() },
        headers,
        rows,
      );
      downloadPdfBytes(bytes, filename);
      return { ok: true };
    }

    const { resolveApiBase } = await import("./api-base");
    const { getAccessToken } = await import("./api");
    const apiUrl = opts?.apiUrl || `${resolveApiBase()}/exports/pdf/`;
    const token = getAccessToken();
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/pdf",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          title,
          headers,
          rows,
          subtitle: opts?.subtitle,
          format: "certificate",
          certificate: opts?.certificate,
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return { ok: true };
      }
    } catch {
      // fall through to client PDF
    }

    const bytes = opts?.certificate
      ? buildBrandedCertificatePdf(opts.certificate)
      : buildBrandedReportPdf(
          { title, subtitle: opts?.subtitle, generatedAt: new Date().toLocaleString() },
          headers,
          rows,
        );
    downloadPdfBytes(bytes, filename);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "PDF export failed" };
  }
}

/** Export a single certificate in the branded ShikshaLab certificate layout. */
export async function exportCertificatePdf(
  data: import("./pdf-export").CertificatePdfData,
  opts?: { filename?: string },
) {
  const filename = opts?.filename || `${data.certificateNumber}.pdf`;
  await exportPdf(`Certificate — ${data.studentName}`, [], [], {
    filename,
    format: "certificate",
    certificate: data,
  });
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "export";
}

export { slugify };

export function parseCsvFile(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      resolve(lines.map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

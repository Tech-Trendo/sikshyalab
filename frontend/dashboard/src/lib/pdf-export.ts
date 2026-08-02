/**
 * ShikshaLab branded PDF export — shared layout for reports & certificates.
 * Stdlib-only PDF generation (no external PDF libraries).
 */

export const PDF_BRAND = {
  primary: { r: 0.141, g: 0.278, b: 0.467 },
  accent: { r: 0.961, g: 0.62, b: 0.051 },
  text: { r: 0.12, g: 0.16, b: 0.22 },
  muted: { r: 0.45, g: 0.5, b: 0.56 },
  border: { r: 0.88, g: 0.9, b: 0.93 },
  rowAlt: { r: 0.97, g: 0.98, b: 0.99 },
  white: { r: 1, g: 1, b: 1 },
  instituteName: "ShikshaLab",
  instituteTagline: "Premier IT Training Institute",
  instituteWebsite: "www.shikshalab.com",
  instituteEmail: "certificates@shikshalab.com",
} as const;

export type CertificatePdfData = {
  studentName: string;
  courseName: string;
  certificateNumber: string;
  verificationCode: string;
  issueDate: string;
  completionDate?: string;
  duration?: string;
  grade?: string;
  instructorName?: string;
  batchName?: string;
  instituteName?: string;
  purpose?: string;
};

export type BrandedPdfMeta = {
  title: string;
  subtitle?: string;
  generatedAt?: string;
};

type Rgb = { r: number; g: number; b: number };

function escapePdfText(s: string) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function setFill(stream: string[], color: Rgb) {
  stream.push(`${color.r} ${color.g} ${color.b} rg`);
}

function setStroke(stream: string[], color: Rgb) {
  stream.push(`${color.r} ${color.g} ${color.b} RG`);
}

function drawRect(stream: string[], x: number, y: number, w: number, h: number, fill = true) {
  stream.push(`${x} ${y} ${w} ${h} re`);
  stream.push(fill ? "f" : "S");
}

function drawText(
  stream: string[],
  x: number,
  y: number,
  text: string,
  size: number,
  opts?: { bold?: boolean; color?: Rgb; maxWidth?: number },
) {
  const font = opts?.bold ? "/F2" : "/F1";
  const label = escapePdfText(truncate(text, opts?.maxWidth ? Math.floor(opts.maxWidth / (size * 0.5)) : 80));
  if (opts?.color) setFill(stream, opts.color);
  stream.push("BT", `${font} ${size} Tf`, `${x} ${y} Td`, `(${label}) Tj`, "ET");
  if (opts?.color) setFill(stream, PDF_BRAND.text);
}

function truncate(s: string, max: number) {
  const t = String(s ?? "");
  return t.length <= max ? t : `${t.slice(0, Math.max(0, max - 1))}…`;
}

function drawBrandHeader(stream: string[], pageW: number, pageH: number, meta: BrandedPdfMeta) {
  const barH = 28;
  setFill(stream, PDF_BRAND.primary);
  drawRect(stream, 0, pageH - barH, pageW * 0.72, barH);
  setFill(stream, PDF_BRAND.accent);
  drawRect(stream, pageW * 0.72, pageH - barH, pageW * 0.28, barH);

  drawText(stream, 40, pageH - 19, PDF_BRAND.instituteName, 14, { bold: true, color: PDF_BRAND.white });
  drawText(stream, pageW - 40, pageH - 19, "Official Report", 10, { color: PDF_BRAND.white, maxWidth: 120 });

  drawText(stream, 40, pageH - 58, meta.title, 18, { bold: true, color: PDF_BRAND.primary });
  const subtitle = meta.subtitle || `Generated ${meta.generatedAt || new Date().toLocaleString()}`;
  drawText(stream, 40, pageH - 76, subtitle, 9, { color: PDF_BRAND.muted });

  setStroke(stream, PDF_BRAND.border);
  stream.push("1 w");
  drawRect(stream, 40, pageH - 88, pageW - 80, 0.5, false);
}

function drawBrandFooter(stream: string[], pageW: number, pageNum: number, totalPages: number) {
  setStroke(stream, PDF_BRAND.border);
  stream.push("0.5 w");
  drawRect(stream, 40, 42, pageW - 80, 0.5, false);

  drawText(stream, 40, 26, PDF_BRAND.instituteName, 9, { bold: true, color: PDF_BRAND.primary });
  drawText(stream, 40, 14, `${PDF_BRAND.instituteTagline}  |  ${PDF_BRAND.instituteWebsite}  |  ${PDF_BRAND.instituteEmail}`, 8, {
    color: PDF_BRAND.muted,
    maxWidth: 420,
  });
  drawText(stream, pageW - 40, 20, `Page ${pageNum} of ${totalPages}`, 8, { color: PDF_BRAND.muted });
  drawText(stream, pageW - 40, 10, "ShikshaLab Verified", 7, { color: PDF_BRAND.accent });
}

function paginateRows<T>(rows: T[], perPage: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
  return pages.length ? pages : [[]];
}

export function buildBrandedReportPdf(
  meta: BrandedPdfMeta,
  headers: string[],
  rows: (string | number)[][],
): Uint8Array {
  const pageW = 612;
  const pageH = 792;
  const rowsPerPage = 22;
  const rowPages = paginateRows(rows, rowsPerPage);
  const totalPages = rowPages.length;
  const colCount = Math.max(headers.length, 1);
  const tableW = pageW - 80;
  const colW = tableW / colCount;
  const headerH = 22;
  const rowH = 18;

  const pageStreams: string[] = [];

  rowPages.forEach((pageRows, pageIndex) => {
    const stream: string[] = ["q"];
    setFill(stream, PDF_BRAND.white);
    drawRect(stream, 0, 0, pageW, pageH);

    drawBrandHeader(stream, pageW, pageH, {
      ...meta,
      subtitle: pageIndex === 0 ? meta.subtitle : `${meta.title} (continued)`,
    });

    let y = pageH - 110;

    setFill(stream, PDF_BRAND.primary);
    drawRect(stream, 40, y - headerH, tableW, headerH);
    headers.forEach((h, i) => {
      drawText(stream, 46 + i * colW, y - 15, String(h), 9, { bold: true, color: PDF_BRAND.white, maxWidth: colW - 10 });
    });
    y -= headerH;

    pageRows.forEach((row, rowIndex) => {
      if (rowIndex % 2 === 1) {
        setFill(stream, PDF_BRAND.rowAlt);
        drawRect(stream, 40, y - rowH, tableW, rowH);
      }
      setStroke(stream, PDF_BRAND.border);
      stream.push("0.25 w");
      drawRect(stream, 40, y - rowH, tableW, rowH, false);

      row.forEach((cell, i) => {
        drawText(stream, 46 + i * colW, y - 13, String(cell ?? ""), 8, { maxWidth: colW - 10 });
      });
      y -= rowH;
    });

    if (pageIndex === totalPages - 1) {
      drawText(stream, 40, y - 16, `Total records: ${rows.length}`, 9, { bold: true, color: PDF_BRAND.primary });
    }

    drawBrandFooter(stream, pageW, pageIndex + 1, totalPages);
    stream.push("Q");
    pageStreams.push(stream.join("\n"));
  });

  return assemblePdf(pageStreams, pageW, pageH);
}

export function buildBrandedCertificatePdf(data: CertificatePdfData): Uint8Array {
  const pageW = 612;
  const pageH = 792;
  const stream: string[] = ["q"];

  setFill(stream, PDF_BRAND.white);
  drawRect(stream, 0, 0, pageW, pageH);

  setStroke(stream, PDF_BRAND.primary);
  stream.push("2 w");
  drawRect(stream, 30, 30, pageW - 60, pageH - 60, false);

  setStroke(stream, PDF_BRAND.border);
  stream.push("1 w");
  drawRect(stream, 45, 45, pageW - 90, pageH - 90, false);

  setFill(stream, PDF_BRAND.primary);
  drawRect(stream, 45, pageH - 55, pageW - 90 - 80, 8);
  setFill(stream, PDF_BRAND.accent);
  drawRect(stream, pageW - 45 - 80, pageH - 55, 80, 8);

  const institute = data.instituteName || PDF_BRAND.instituteName;
  drawText(stream, pageW / 2 - institute.length * 3.2, pageH - 95, institute, 20, { bold: true, color: PDF_BRAND.primary });
  drawText(stream, pageW / 2 - 70, pageH - 125, (data.purpose || "CERTIFICATE OF ACHIEVEMENT").toUpperCase(), 10, { color: PDF_BRAND.accent });
  drawText(stream, pageW / 2 - data.studentName.length * 4.5, pageH - 200, data.studentName, 28, { bold: true, color: PDF_BRAND.primary });
  drawText(stream, pageW / 2 - 95, pageH - 235, "has successfully completed", 11, { color: PDF_BRAND.muted });
  drawText(stream, pageW / 2 - data.courseName.length * 3, pageH - 260, data.courseName, 16, { bold: true, color: PDF_BRAND.text });

  if (data.batchName) {
    drawText(stream, pageW / 2 - 60, pageH - 285, `Batch: ${data.batchName}`, 10, { color: PDF_BRAND.muted });
  }

  const detailsY = 220;
  drawText(stream, 70, detailsY + 40, `Certificate No: ${data.certificateNumber}`, 10, { color: PDF_BRAND.text });
  drawText(stream, 70, detailsY + 22, `Verification Code: ${data.verificationCode}`, 9, { color: PDF_BRAND.muted });
  drawText(stream, 70, detailsY + 4, `Issue Date: ${data.issueDate}`, 9, { color: PDF_BRAND.muted });
  if (data.completionDate) drawText(stream, 70, detailsY - 14, `Completion Date: ${data.completionDate}`, 9, { color: PDF_BRAND.muted });
  if (data.duration) drawText(stream, 70, detailsY - 32, `Duration: ${data.duration}`, 9, { color: PDF_BRAND.muted });
  if (data.grade) drawText(stream, 70, detailsY - 50, `Grade: ${data.grade}`, 9, { color: PDF_BRAND.muted });
  if (data.instructorName) drawText(stream, 70, detailsY - 68, `Instructor: ${data.instructorName}`, 9, { color: PDF_BRAND.muted });

  setStroke(stream, PDF_BRAND.primary);
  stream.push("1 w");
  drawRect(stream, pageW - 145, detailsY - 20, 80, 80, false);
  drawText(stream, pageW - 130, detailsY + 10, "QR VERIFY", 8, { color: PDF_BRAND.primary });
  drawText(stream, pageW - 138, detailsY - 5, truncate(data.verificationCode, 12), 7, { color: PDF_BRAND.muted });

  drawText(stream, pageW / 2 - 120, 95, PDF_BRAND.instituteTagline, 9, { color: PDF_BRAND.muted });
  drawText(stream, pageW / 2 - 55, 70, "ShikshaLab Verified", 9, { bold: true, color: PDF_BRAND.primary });
  setFill(stream, PDF_BRAND.accent);
  drawRect(stream, pageW / 2 + 45, 72, 6, 6);

  stream.push("Q");
  return assemblePdf([stream.join("\n")], pageW, pageH);
}

function assemblePdf(pageStreams: string[], pageW: number, pageH: number): Uint8Array {
  const contentStart = 4;
  const fontRegular = contentStart + pageStreams.length * 2;
  const fontBold = fontRegular + 1;

  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");

  const kids = pageStreams.map((_, i) => `${contentStart + i * 2} 0 R`).join(" ");
  objects.push(`2 0 obj<< /Type /Pages /Kids [${kids}] /Count ${pageStreams.length} >>endobj\n`);
  objects.push(`${fontRegular} 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n`);
  objects.push(`${fontBold} 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>endobj\n`);

  pageStreams.forEach((pageStream, i) => {
    const pageNum = contentStart + i * 2;
    const contentNum = pageNum + 1;
    objects.push(
      `${pageNum} 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${contentNum} 0 R /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> >>endobj\n`,
    );
    objects.push(`${contentNum} 0 obj<< /Length ${pageStream.length} >>stream\n${pageStream}\nendstream\nendobj\n`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

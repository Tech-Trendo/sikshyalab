/**
 * Pixel-accurate internship certificate renderer — matches the official
 * landscape template (left geometric panel + gold-ring logo + centered copy).
 * Fixed canvas: 1260 × 890 px — preview and PNG/PDF export share the same bitmap.
 */

import { downloadPdfBytes } from "./pdf-export";

export const CERT_WIDTH = 1260;
export const CERT_HEIGHT = 890;

/** Official Shiksha Lab logo for certificates (the provided brand mark). */
export const SHIKSHALAB_CERTIFICATE_LOGO = "/images/certificates/shikshalab-certificate-logo.png?v=1";

/** Stored official internship certificate UI — used as-is; only live fields are overlaid. */
export const CERTIFICATE_REFERENCE_IMAGE = "/images/certificates/internship-reference.png?v=4";

/** Certificates always use the given Shiksha Lab logo — never other logos. */
export function resolveCertificateLogoUrl(logoUrl?: string | null): string {
  void logoUrl;
  return SHIKSHALAB_CERTIFICATE_LOGO;
}

export type CertificateCanvasData = {
  recipientName: string;
  institution: string;
  courseName: string;
  startDate: string;
  endDate: string;
  skills: string;
  issueDate: string;
  supervisorName: string;
  certificateNumber: string;
  signatureImageUrl?: string;
  /** Defaults to INTERNSHIP to match the official template. */
  certificateType?: string;
  instituteName?: string;
};

const COLORS = {
  primary: "#16305c",
  darkAccent: "#0d2143",
  darkest: "#08182f",
  panelNavy: "#1a3558",
  cream: "#e8e6e1",
  gold: "#c9a227",
  goldRing: "#d4af37",
  goldDark: "#b8953e",
  blue: "#16305c",
  body: "#1a1a1a",
  secondary: "#333333",
  muted: "#555555",
  white: "#ffffff",
  signature: "#111111",
} as const;

const VERIFY_URL = "www.shikshalab.com/verify";
const INSTITUTE = "ShikshaLab";

const FONT_PLAYFAIR = '"Playfair Display", Georgia, "Times New Roman", serif';
const FONT_GREAT_VIBES = '"Great Vibes", "Segoe Script", cursive';
const FONT_ARIAL = "Arial, Helvetica, sans-serif";

/** Horizontal center of the white content column (right of left panel). */
const CONTENT_CX = 780;
const CONTENT_RIGHT = 1180;

let fontsReady: Promise<void> | null = null;

/** Load Google Fonts and wait until document.fonts is ready. */
export function ensureCertificateFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (fontsReady) return fontsReady;

  fontsReady = (async () => {
    const id = "shikshalab-certificate-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:wght@400;700&display=swap";
      document.head.appendChild(link);
    }
    const families = [
      { family: "Playfair Display", weight: "400" },
      { family: "Playfair Display", weight: "700" },
      { family: "Great Vibes", weight: "400" },
    ];
    const load = Promise.all(
      families.map(({ family, weight }) =>
        document.fonts.load(`${weight} 16px ${family}`).catch(() => undefined),
      ),
    ).then(() => document.fonts.ready);
    await Promise.race([
      load,
      new Promise<void>((resolve) => setTimeout(resolve, 2500)),
    ]);
  })();

  return fontsReady;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

let cachedDefaultLogo: HTMLImageElement | null = null;
let cachedDefaultLogoSrc: string | null = null;
let cachedBackground: HTMLImageElement | null | undefined;
let cachedBackgroundSrc: string | null = null;

/** Official internship layout background (exact reference image). */
export async function loadCertificateBackground(): Promise<HTMLImageElement | null> {
  if (cachedBackground !== undefined && cachedBackgroundSrc === CERTIFICATE_REFERENCE_IMAGE) {
    return cachedBackground;
  }
  cachedBackgroundSrc = CERTIFICATE_REFERENCE_IMAGE;
  cachedBackground = await loadImage(CERTIFICATE_REFERENCE_IMAGE);
  return cachedBackground;
}

/** Load certificate logo — custom upload wins, otherwise the official Shiksha Lab logo. */
export async function loadCertificateLogo(logoUrl?: string | null): Promise<HTMLImageElement | null> {
  const src = resolveCertificateLogoUrl(logoUrl);
  if (!logoUrl && cachedDefaultLogo && cachedDefaultLogoSrc === src) {
    return cachedDefaultLogo;
  }
  const img = await loadImage(src);
  if (!logoUrl && img) {
    cachedDefaultLogo = img;
    cachedDefaultLogoSrc = src;
  }
  return img;
}

function fillPolygon(ctx: CanvasRenderingContext2D, points: [number, number][], fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

function formatDisplayDate(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function formatShortDate(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function setFont(ctx: CanvasRenderingContext2D, spec: string) {
  ctx.font = spec;
}

function drawCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  opts?: { letterSpacing?: string },
) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  setFont(ctx, font);
  if (opts?.letterSpacing) ctx.letterSpacing = opts.letterSpacing;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawRight(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  opts?: { letterSpacing?: string },
) {
  ctx.save();
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  setFont(ctx, font);
  if (opts?.letterSpacing) ctx.letterSpacing = opts.letterSpacing;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Draw mixed normal/bold runs, wrapping to maxWidth, centered. */
function drawWrappedMixed(
  ctx: CanvasRenderingContext2D,
  runs: { text: string; bold?: boolean }[],
  cx: number,
  startY: number,
  maxWidth: number,
  fontSize: number,
  color: string,
  lineHeight: number,
) {
  type Token = { text: string; bold?: boolean; width: number };
  const tokens: Token[] = [];
  for (const run of runs) {
    const words = run.text.split(/(\s+)/);
    for (const w of words) {
      if (!w) continue;
      const font = `${run.bold ? "bold " : ""}${fontSize}px ${FONT_ARIAL}`;
      setFont(ctx, font);
      tokens.push({ text: w, bold: run.bold, width: ctx.measureText(w).width });
    }
  }

  const lines: Token[][] = [];
  let current: Token[] = [];
  let lineW = 0;
  for (const tok of tokens) {
    if (lineW + tok.width > maxWidth && current.length) {
      lines.push(current);
      current = [];
      lineW = 0;
    }
    current.push(tok);
    lineW += tok.width;
  }
  if (current.length) lines.push(current);

  let y = startY;
  for (const line of lines) {
    const total = line.reduce((n, t) => n + t.width, 0);
    let x = cx - total / 2;
    for (const tok of line) {
      setFont(ctx, `${tok.bold ? "bold " : ""}${fontSize}px ${FONT_ARIAL}`);
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(tok.text, x, y);
      x += tok.width;
    }
    y += lineHeight;
  }
  return y;
}

function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null) {
  const cx = 205;
  const cy = 300;
  const outerR = 95;
  const innerR = 78;

  // Gold ring (same as template seal)
  const grad = ctx.createLinearGradient(cx - outerR, cy - outerR, cx + outerR, cy + outerR);
  grad.addColorStop(0, "#f0d78c");
  grad.addColorStop(0.45, COLORS.goldRing);
  grad.addColorStop(1, "#a67c1a");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fill();

  if (!logo) return;

  // Full-cover round logo — fills entire inner seal (no gaps / no Trendotech bleed)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.clip();

  const diameter = innerR * 2;
  const aspect = logo.naturalWidth / logo.naturalHeight || 1;
  let dw: number;
  let dh: number;
  if (aspect >= 1) {
    // wider logo — cover height, crop sides
    dh = diameter;
    dw = diameter * aspect;
  } else {
    dw = diameter;
    dh = diameter / aspect;
  }
  ctx.drawImage(logo, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

/**
 * Draw certificate from the official template image.
 * Left panel + Shiksha Lab seal stay from the template; only the white content
 * column is cleared and filled with live certificate fields.
 */
export function renderCertificate(
  ctx: CanvasRenderingContext2D,
  data: CertificateCanvasData,
  logo: HTMLImageElement | null,
  signature?: HTMLImageElement | null,
  background?: HTMLImageElement | null,
) {
  ctx.clearRect(0, 0, CERT_WIDTH, CERT_HEIGHT);

  if (background) {
    // Exact given certificate UI (geometry, seal, colors)
    ctx.drawImage(background, 0, 0, CERT_WIDTH, CERT_HEIGHT);

    // Clear only the white content column so we can write live fields
    // (left artwork + round Shiksha Lab seal stay untouched)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(455, 0);
    ctx.lineTo(CERT_WIDTH, 0);
    ctx.lineTo(CERT_WIDTH, CERT_HEIGHT);
    ctx.lineTo(355, CERT_HEIGHT);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(0, 0, CERT_WIDTH, CERT_HEIGHT);
    ctx.restore();
  } else {
    // Rare fallback if the reference image failed to load
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(0, 0, CERT_WIDTH, CERT_HEIGHT);
    fillPolygon(ctx, [[0, 0], [320, 0], [80, 890], [0, 890]], COLORS.primary);
    fillPolygon(ctx, [[320, 0], [455, 0], [215, 890], [80, 890]], COLORS.cream);
    fillPolygon(ctx, [[0, 0], [290, 0], [40, 890], [0, 890]], COLORS.panelNavy);
    fillPolygon(ctx, [[0, 380], [250, 320], [180, 890], [0, 890]], COLORS.darkAccent);
    fillPolygon(ctx, [[0, 560], [160, 520], [90, 890], [0, 890]], COLORS.darkest);
    drawLogo(ctx, logo);
  }

  // Certificate number — top right, uppercase (reference style)
  const certNo = `CERTIFICATE NO. : ${data.certificateNumber}`;
  drawRight(ctx, certNo, CONTENT_RIGHT, 48, `bold 14px ${FONT_ARIAL}`, COLORS.body, {
    letterSpacing: "0.5px",
  });

  // Title block — same hierarchy as the given UI
  drawCentered(ctx, "Certificate", CONTENT_CX, 155, `82px ${FONT_PLAYFAIR}`, COLORS.primary);
  const certType = (data.certificateType || "INTERNSHIP").toUpperCase();
  drawCentered(ctx, `OF ${certType}`, CONTENT_CX, 205, `bold 26px ${FONT_ARIAL}`, COLORS.body, {
    letterSpacing: "2px",
  });

  drawCentered(ctx, "This is to certify that", CONTENT_CX, 255, `18px ${FONT_ARIAL}`, COLORS.secondary);

  drawCentered(
    ctx,
    data.recipientName || "Recipient Name",
    CONTENT_CX,
    345,
    `92px ${FONT_GREAT_VIBES}`,
    COLORS.goldDark,
  );

  const start = formatShortDate(data.startDate) || data.startDate || "";
  const end = formatShortDate(data.endDate) || data.endDate || "";
  const institution = data.institution || "Institution";
  const course = data.courseName || "Course";
  const skills = data.skills || "relevant technologies";
  const institute = data.instituteName || INSTITUTE;

  drawWrappedMixed(
    ctx,
    [
      { text: "student of " },
      { text: institution, bold: true },
      { text: ", completed their " },
      { text: course, bold: true },
      { text: " at " },
      { text: institute, bold: true },
      { text: " from " },
      { text: start || "—", bold: true },
      { text: " to " },
      { text: end || "—", bold: true },
      { text: `, gaining hands-on experience in ${skills}.` },
    ],
    CONTENT_CX,
    400,
    640,
    17,
    COLORS.body,
    28,
  );

  const issueDisplay = formatDisplayDate(data.issueDate) || data.issueDate;
  drawCentered(ctx, issueDisplay, CONTENT_CX, 545, `bold 20px ${FONT_ARIAL}`, COLORS.body);

  const supervisor = data.supervisorName || "Program Supervisor";
  const sigX = 520;
  if (signature) {
    const sigW = 170;
    const sigH = 52;
    ctx.drawImage(signature, sigX - sigW / 2, 600, sigW, sigH);
  } else {
    const signatureScript = supervisor.split(" ")[0] || supervisor;
    drawCentered(ctx, signatureScript, sigX, 640, `48px ${FONT_GREAT_VIBES}`, COLORS.signature);
  }

  ctx.save();
  ctx.strokeStyle = COLORS.body;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sigX - 85, 655);
  ctx.lineTo(sigX + 85, 655);
  ctx.stroke();
  ctx.restore();

  drawCentered(ctx, supervisor, sigX, 685, `bold 17px ${FONT_ARIAL}`, COLORS.primary);
  drawCentered(ctx, "Supervisor", sigX, 708, `14px ${FONT_ARIAL}`, COLORS.secondary);

  drawRight(ctx, "Verify At:", CONTENT_RIGHT, 685, `bold 16px ${FONT_ARIAL}`, COLORS.primary);
  drawRight(ctx, VERIFY_URL, CONTENT_RIGHT, 708, `14px ${FONT_ARIAL}`, COLORS.primary);
}

/** Create an off-screen 1260×890 canvas, render, and return it. */
export async function createCertificateCanvas(
  data: CertificateCanvasData,
  logoUrl?: string | null,
): Promise<HTMLCanvasElement> {
  await ensureCertificateFonts();
  const [logo, background] = await Promise.all([
    loadCertificateLogo(logoUrl),
    loadCertificateBackground(),
  ]);
  const signature = data.signatureImageUrl ? await loadImage(data.signatureImageUrl) : null;
  const canvas = document.createElement("canvas");
  canvas.width = CERT_WIDTH;
  canvas.height = CERT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  renderCertificate(ctx, data, logo, signature, background);
  return canvas;
}

export function downloadCertificatePng(canvas: HTMLCanvasElement, filename: string) {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Embed the canvas as a full-page image PDF at 1260×890 pt (same proportions). */
function buildPdfFromCanvasImage(canvas: HTMLCanvasElement): Uint8Array {
  const jpegBase64 = canvas.toDataURL("image/jpeg", 0.95).split(",")[1] ?? "";
  const jpegBytes = base64ToBytes(jpegBase64);
  const pageW = CERT_WIDTH;
  const pageH = CERT_HEIGHT;

  const imgObj = 4;
  const pageObj = 3;
  const contentObj = 5;
  const contentStream = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im1 Do\nQ`;
  const contentLength = contentStream.length;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  const push = (s: string) => {
    offsets.push(pdf.length);
    pdf += s;
  };

  push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  push(`2 0 obj<< /Type /Pages /Kids [${pageObj} 0 R] /Count 1 >>endobj\n`);
  push(
    `${pageObj} 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${contentObj} 0 R /Resources << /XObject << /Im1 ${imgObj} 0 R >> >> >>endobj\n`,
  );

  offsets.push(pdf.length);
  pdf += `${imgObj} 0 obj<< /Type /XObject /Subtype /Image /Width ${pageW} /Height ${pageH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>stream\n`;
  for (let i = 0; i < jpegBytes.length; i++) pdf += String.fromCharCode(jpegBytes[i]!);
  pdf += "\nendstream\nendobj\n";

  push(`${contentObj} 0 obj<< /Length ${contentLength} >>stream\n${contentStream}\nendstream\nendobj\n`);

  const xrefPos = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  // Must keep Latin-1 bytes — TextEncoder UTF-8 corrupts JPEG stream → blank PDF
  const out = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) out[i] = pdf.charCodeAt(i) & 0xff;
  return out;
}

export function downloadCertificatePdf(canvas: HTMLCanvasElement, filename: string) {
  const bytes = buildPdfFromCanvasImage(canvas);
  downloadPdfBytes(bytes, filename);
}

/** Map legacy / dashboard certificate rows into canvas field shape. */
export function toCanvasData(
  partial: Partial<CertificateCanvasData> & {
    studentName?: string;
    collegeName?: string;
  },
): CertificateCanvasData {
  return {
    recipientName: partial.recipientName || partial.studentName || "Student Name",
    institution: partial.institution || partial.collegeName || "ShikshaLab Institute",
    courseName: partial.courseName || "UI/UX Design Internship",
    startDate: partial.startDate || "2026-06-26",
    endDate: partial.endDate || "2026-09-04",
    skills: partial.skills || "industry tools and professional workflows",
    issueDate: partial.issueDate || new Date().toISOString().slice(0, 10),
    supervisorName: partial.supervisorName || "Program Supervisor",
    certificateNumber: partial.certificateNumber || "SL-2026-0001",
    signatureImageUrl: partial.signatureImageUrl,
    certificateType: partial.certificateType || "INTERNSHIP",
    instituteName: partial.instituteName || INSTITUTE,
  };
}

/** Ensure certificate numbers use the SL institute prefix. */
export function formatCertificateNumber(value: string, fallbackSeq = 1): string {
  const trimmed = value.trim();
  if (/^SL-/i.test(trimmed)) return trimmed.toUpperCase();
  const year = new Date().getFullYear();
  const seq = String(fallbackSeq).padStart(4, "0");
  return `SL-${year}-${seq}`;
}

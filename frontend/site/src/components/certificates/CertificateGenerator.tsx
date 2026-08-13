import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileImage, Loader2 } from "lucide-react";
import {
  CERT_HEIGHT,
  CERT_WIDTH,
  type CertificateCanvasData,
  downloadCertificatePdf,
  downloadCertificatePng,
  ensureCertificateFonts,
  loadCertificateBackground,
  loadCertificateLogo,
  renderCertificate,
} from "@/lib/certificate-canvas";

function loadSignature(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

type Props = {
  data: CertificateCanvasData;
  logoUrl?: string | null;
  className?: string;
  showForm?: boolean;
  onChange?: (data: CertificateCanvasData) => void;
};

const FIELDS: { key: keyof CertificateCanvasData; label: string; placeholder?: string }[] = [
  { key: "recipientName", label: "Recipient name", placeholder: "Full name" },
  { key: "institution", label: "Institution", placeholder: "College / institute" },
  { key: "courseName", label: "Course name", placeholder: "e.g. UI/UX Design Internship" },
  { key: "startDate", label: "Start date", placeholder: "YYYY-MM-DD" },
  { key: "endDate", label: "End date", placeholder: "YYYY-MM-DD" },
  { key: "skills", label: "Skills", placeholder: "e.g. Figma for wireframing and prototyping" },
  { key: "issueDate", label: "Issue date", placeholder: "YYYY-MM-DD" },
  { key: "supervisorName", label: "Supervisor", placeholder: "Supervisor full name" },
  { key: "certificateNumber", label: "Certificate number", placeholder: "SL-2026-0001" },
];

async function paintCertificate(
  canvas: HTMLCanvasElement,
  data: CertificateCanvasData,
  logoUrl?: string | null,
) {
  await ensureCertificateFonts();
  const [logo, background, signature] = await Promise.all([
    loadCertificateLogo(logoUrl),
    loadCertificateBackground(),
    loadSignature(data.signatureImageUrl),
  ]);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  renderCertificate(ctx, data, logo, signature, background);
}

/** Scaled wrapper around a fixed 1260×890 canvas — preview matches PNG export pixel-for-pixel. */
export function CertificateCanvasPreview({ data, logoUrl, className = "" }: Omit<Props, "showForm" | "onChange">) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);

  const paint = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRendering(true);
    try {
      await paintCertificate(canvas, data, logoUrl);
    } finally {
      setRendering(false);
    }
  }, [data, logoUrl]);

  useEffect(() => {
    void paint();
  }, [paint]);

  return (
    <div className={`-mx-1 overflow-x-auto overscroll-x-contain ${className}`}>
      <div
        className="relative mx-auto w-full min-w-[min(100%,520px)]"
        style={{ aspectRatio: `${CERT_WIDTH}/${CERT_HEIGHT}` }}
      >
        <canvas
          ref={canvasRef}
          width={CERT_WIDTH}
          height={CERT_HEIGHT}
          className="block h-full w-full"
          aria-label="Certificate of Internship preview"
        />
        {rendering && (
          <div className="absolute inset-0 grid place-items-center bg-white/60">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}

export function CertificateGenerator({ data, logoUrl, className = "", showForm = true, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);
  const [downloading, setDownloading] = useState<"png" | "pdf" | null>(null);

  const paint = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRendering(true);
    try {
      await paintCertificate(canvas, data, logoUrl);
    } finally {
      setRendering(false);
    }
  }, [data, logoUrl]);

  useEffect(() => {
    void paint();
  }, [paint]);

  const handleDownload = async (type: "png" | "pdf") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDownloading(type);
    await paintCertificate(canvas, data, logoUrl);
    const base = data.certificateNumber || "certificate";
    if (type === "png") downloadCertificatePng(canvas, `${base}.png`);
    else downloadCertificatePdf(canvas, `${base}.pdf`);
    setDownloading(null);
  };

  return (
    <div className={`grid gap-6 ${showForm ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""} ${className}`}>
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/20 p-3 shadow-sm">
          <div className="relative w-full" style={{ aspectRatio: `${CERT_WIDTH}/${CERT_HEIGHT}` }}>
            <canvas
              ref={canvasRef}
              width={CERT_WIDTH}
              height={CERT_HEIGHT}
              className="block h-full w-full bg-white"
              aria-label="Certificate of Internship preview"
            />
            {rendering && (
              <div className="absolute inset-0 grid place-items-center bg-white/60">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="btn-highlight"
            disabled={rendering || downloading !== null}
            onClick={() => void handleDownload("png")}
          >
            {downloading === "png" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileImage className="mr-2 h-4 w-4" />
            )}
            Download PNG
          </Button>
          <Button variant="outline" disabled={rendering || downloading !== null} onClick={() => void handleDownload("pdf")}>
            {downloading === "pdf" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Uses the imported internship certificate layout ({CERT_WIDTH}×{CERT_HEIGHT}px).
        </p>
      </div>

      {showForm && onChange && (
        <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
          <p className="text-sm font-semibold text-primary">Certificate fields</p>
          {FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <Label htmlFor={`cert-${key}`} className="text-xs">
                {label}
              </Label>
              <Input
                id={`cert-${key}`}
                name={key}
                autoComplete="off"
                className="mt-1 h-9"
                value={String(data[key] ?? "")}
                placeholder={placeholder}
                onChange={(e) => {
                  const value =
                    key === "certificateNumber"
                      ? e.target.value.toUpperCase().replace(/^SLB-/i, "SL-")
                      : e.target.value;
                  onChange({ ...data, [key]: value });
                }}
              />
            </div>
          ))}
          <div>
            <Label htmlFor="cert-signature" className="text-xs">
              Digital signature
            </Label>
            <Input
              id="cert-signature"
              name="signature"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mt-1 h-9 cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                onChange({ ...data, signatureImageUrl: url });
              }}
            />
            {data.signatureImageUrl && (
              <p className="mt-1 text-[10px] text-muted-foreground">Signature image attached</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

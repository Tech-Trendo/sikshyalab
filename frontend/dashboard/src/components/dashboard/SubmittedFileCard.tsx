import { useState } from "react";
import { Download, ExternalLink, FileText, ImageIcon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/components/dashboard/PdfViewer";
import { resolveMediaUrl } from "@/lib/media-url";
import { downloadSubmissionAttachment } from "@/lib/submission-download";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type SubmittedFileInfo = {
  submissionId?: string;
  fileName?: string;
  fileUrl?: string | null;
  fileType?: string;
  fileSize?: number;
  submittedAt?: string;
  statusLabel?: string;
};

function formatBytes(n?: number): string | null {
  if (n == null || !Number.isFinite(n) || n < 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()!.toUpperCase() : "";
}

export function fileKindFromName(
  name?: string,
  mime?: string,
): "pdf" | "image" | "other" {
  const n = (name || "").toLowerCase();
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf") || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(n)) return "image";
  return "other";
}

type Props = SubmittedFileInfo & {
  className?: string;
  emptyLabel?: string;
};

export function SubmittedFileCard({
  submissionId,
  fileName,
  fileUrl,
  fileType,
  fileSize,
  submittedAt,
  statusLabel,
  className,
  emptyLabel = "No file attached",
}: Props) {
  const [previewError, setPreviewError] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const href = resolveMediaUrl(fileUrl) || fileUrl || "";
  const name = fileName || "Submitted file";
  const kind = fileKindFromName(name, fileType);
  const typeLabel = fileType || extensionOf(name) || (kind === "pdf" ? "PDF" : kind === "image" ? "Image" : "File");
  const sizeLabel = formatBytes(fileSize);
  const submittedLabel = submittedAt
    ? new Date(submittedAt).toLocaleString()
    : null;

  const handleDownload = async () => {
    if (!submissionId) {
      toast.error("Cannot download — submission id is missing. Refresh and try again.");
      return;
    }
    setDownloading(true);
    try {
      const result = await downloadSubmissionAttachment(submissionId, name);
      if (result.ok) {
        toast.success("Download started");
      } else {
        toast.error(result.error || "Could not download the file");
      }
    } catch {
      toast.error("Could not download the file");
    } finally {
      setDownloading(false);
    }
  };

  if (!href && !submissionId) {
    return (
      <div className={cn("rounded-lg border border-border/60 p-3 text-sm text-muted-foreground", className)}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 rounded-lg border border-border/60 p-3", className)}>
      {kind === "image" && href && !previewError ? (
        <img
          src={href}
          alt={name}
          className="max-h-48 w-full rounded-md object-contain bg-muted/40"
          onError={() => setPreviewError(true)}
        />
      ) : null}
      {previewError ? (
        <p className="text-xs text-destructive">Could not load the file preview. Use View or Download.</p>
      ) : null}
      <div className="flex items-start gap-2">
        {kind === "image" ? (
          <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[typeLabel, sizeLabel, submittedLabel ? `Submitted ${submittedLabel}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {statusLabel ? <Badge variant="secondary">{statusLabel}</Badge> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {kind === "pdf" ? (
          <Button size="sm" variant="outline" onClick={() => setPdfOpen(true)} disabled={!href}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" /> View
          </Button>
        ) : (
          <Button size="sm" variant="outline" asChild disabled={!href}>
            <a href={href || "#"} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (!href) e.preventDefault(); }}>
              <ExternalLink className="mr-1 h-3.5 w-3.5" /> View
            </a>
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={downloading || !submissionId}
          onClick={() => void handleDownload()}
        >
          {downloading ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1 h-3.5 w-3.5" />
          )}
          {downloading ? "Downloading…" : "Download"}
        </Button>
      </div>
      {pdfOpen && href ? (
        <PdfViewer src={href} fileName={name} onClose={() => setPdfOpen(false)} />
      ) : null}
    </div>
  );
}

export function SubmissionStatusBadge({
  status,
  apiStatus,
}: {
  status?: "submitted" | "reviewed";
  apiStatus?: string;
}) {
  if (status === "reviewed") {
    return <Badge className="bg-success/15 text-success hover:bg-success/20">Reviewed</Badge>;
  }
  const raw = (apiStatus || "").toUpperCase();
  if (raw === "LATE") return <Badge variant="secondary">Late</Badge>;
  if (raw === "RESUBMITTED") return <Badge variant="secondary">Resubmitted</Badge>;
  return <Badge variant="secondary">Submitted</Badge>;
}

export function submissionStatusLabel(status?: "submitted" | "reviewed", apiStatus?: string): string {
  if (status === "reviewed") return "Reviewed";
  const raw = (apiStatus || "").toUpperCase();
  if (raw === "LATE") return "Late";
  if (raw === "RESUBMITTED") return "Resubmitted";
  return "Submitted";
}

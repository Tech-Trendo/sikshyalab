import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfPageThumbnail } from "@/components/dashboard/PdfPageThumbnail";
import { PdfViewer } from "@/components/dashboard/PdfViewer";
import { ResourceVideoPlayer } from "@/components/dashboard/ResourceVideoPlayer";
import { contentApi } from "@/lib/content-api";
import {
  normalizeSecureMediaKind,
  resourceStreamSrc,
  type SecureMediaKind,
} from "@/lib/signed-media";
import { getWebLoginUrl } from "@/lib/web-url";
import { cn } from "@/lib/utils";

type SecureMediaProps = {
  resourceId: string;
  /** Preferred media kind — used when choosing the renderer. */
  type?: SecureMediaKind | "video" | "notes" | "pdf" | "other";
  /** Alias for `type` when callers already use fallbackType. */
  fallbackType?: SecureMediaKind | "video" | "notes" | "pdf" | "other";
  title?: string;
  fileName?: string;
  alt?: string;
  className?: string;
  nestedTimestamps?: unknown;
  canEdit?: boolean;
};

/**
 * Secure media renderer — always streams through the backend:
 * `/api/v1/content/resources/<id>/stream/`
 * Never uses S3/GCS or signed URLs in the client.
 */
export function SecureMedia({
  resourceId,
  type,
  fallbackType,
  title,
  fileName,
  alt,
  className,
  nestedTimestamps,
  canEdit,
}: SecureMediaProps) {
  const kind = useMemo(
    () =>
      normalizeSecureMediaKind(type ?? fallbackType, {
        fileName,
        fallback: "other",
      }),
    [type, fallbackType, fileName],
  );

  const streamSrc = useMemo(() => resourceStreamSrc(resourceId), [resourceId]);
  const [probe, setProbe] = useState<"loading" | "ready" | "unauthorized" | "error">("loading");
  const [probeDetail, setProbeDetail] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProbe("loading");
    setProbeDetail(null);
    setMediaFailed(false);
    setViewerOpen(false);

    void contentApi.probeResourceStream(resourceId).then((result) => {
      if (cancelled) return;
      if (result.unauthorized) {
        setProbe("unauthorized");
        setProbeDetail(result.detail || "Session expired, please log in again");
        return;
      }
      if (!result.ok) {
        // Still mount media — some backends reject Range probes but allow full GET.
        setProbe("ready");
        setProbeDetail(result.detail || null);
        return;
      }
      setProbe("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [resourceId]);

  if (probe === "loading") {
    return (
      <div
        className={cn(
          "grid min-h-[10rem] place-items-center rounded-md border border-border/60 bg-muted/40 px-4 py-8",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading media…
        </div>
      </div>
    );
  }

  if (probe === "unauthorized") {
    return (
      <div
        className={cn(
          "space-y-3 rounded-md border border-border/60 bg-muted/30 px-4 py-6 text-center",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">
          {probeDetail || "Session expired, please log in again"}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            window.location.href = getWebLoginUrl(
              typeof window !== "undefined" ? window.location.pathname : "/dashboard/resources",
            );
          }}
        >
          Log in again
        </Button>
      </div>
    );
  }

  const displayName = fileName || title || "Document";

  const onMediaError = () => {
    setMediaFailed(true);
    void contentApi.probeResourceStream(resourceId).then((result) => {
      if (result.unauthorized) {
        setProbe("unauthorized");
        setProbeDetail(result.detail || "Session expired, please log in again");
      }
    });
  };

  if (kind === "video") {
    return (
      <div className={cn("relative", className)}>
        <ResourceVideoPlayer
          resourceId={resourceId}
          src={streamSrc}
          title={title}
          nestedTimestamps={nestedTimestamps}
          canEdit={canEdit}
          onMediaError={onMediaError}
        />
        {mediaFailed ? (
          <p className="mt-2 text-xs text-destructive">
            Could not play video. Your session may have expired — try logging in again.
          </p>
        ) : null}
      </div>
    );
  }

  if (kind === "image") {
    return (
      <div className={cn("relative space-y-2", className)}>
        <div className="overflow-hidden rounded-md border border-border/60 bg-muted/20">
          <img
            key={streamSrc}
            src={streamSrc}
            crossOrigin="use-credentials"
            alt={alt || title || displayName}
            className="mx-auto max-h-[28rem] w-auto max-w-full object-contain"
            onError={onMediaError}
            onLoad={() => setMediaFailed(false)}
          />
        </div>
        {mediaFailed ? (
          <p className="text-xs text-destructive">
            Could not load image. Session expired, please log in again.
          </p>
        ) : null}
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <div className={cn("relative space-y-2", className)}>
        <PdfPageThumbnail
          key={streamSrc}
          src={streamSrc}
          title={title}
          className="h-64 w-full max-w-xl"
        />
        <button
          type="button"
          onClick={() => setViewerOpen(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open PDF
        </button>
        {viewerOpen ? (
          <PdfViewer
            src={streamSrc}
            fileName={displayName}
            onClose={() => setViewerOpen(false)}
          />
        ) : null}
      </div>
    );
  }

  // notes / other — embed via same-origin stream (no window.open to raw storage)
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="h-4 w-4" aria-hidden />
        <span className="truncate">{displayName}</span>
      </div>
      <div className="overflow-hidden rounded-md border border-border/60 bg-background">
        <iframe
          key={streamSrc}
          title={title || displayName}
          src={streamSrc}
          className="h-[28rem] w-full"
          // Credentialed cookie auth for same-origin stream (no tokens in the URL).
          // Note: iframe has no crossOrigin attr; cookies are sent for same-origin automatically.
          onError={onMediaError}
        />
      </div>
      <a
        href={streamSrc}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        Open in new tab <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

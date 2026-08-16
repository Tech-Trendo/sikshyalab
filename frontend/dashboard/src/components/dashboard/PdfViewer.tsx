import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Minus, Paperclip, Plus, RotateCcw, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { displayPdfFileName, fetchPdfArrayBuffer, getDocument } from "@/lib/pdfjs";

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 25;
const DEFAULT_ZOOM = 100;

type PdfViewerProps = {
  src: string;
  fileName?: string;
  onClose: () => void;
};

function PdfViewerPage({
  pdf,
  pageNumber,
  scale,
  root,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  root: HTMLElement | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inView, setInView] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [hasRendered, setHasRendered] = useState(false);
  const [box, setBox] = useState({ width: 800, height: 1100 });

  useEffect(() => {
    let cancelled = false;
    void pdf.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      setBox({ width: viewport.width, height: viewport.height });
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber, scale]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { root, rootMargin: "600px 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    if (!inView) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;
    setStatus("loading");

    const run = async () => {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      if (cancelled) return;
      setBox({ width: viewport.width, height: viewport.height });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      renderTask = page.render({ canvasContext: ctx, viewport });
      await renderTask.promise;
      if (!cancelled) {
        setHasRendered(true);
        setStatus("ready");
      }
    };

    void run().catch((err: { name?: string }) => {
      if (cancelled || err?.name === "RenderingCancelledException") return;
      setStatus("error");
    });

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [pdf, pageNumber, scale, inView]);

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden bg-white shadow-md"
      style={{ width: box.width, height: box.height }}
    >
      <canvas
        ref={canvasRef}
        className="block"
        style={{ width: box.width, height: box.height }}
        aria-label={`Page ${pageNumber}`}
      />
      {!hasRendered && status !== "error" ? (
        <Skeleton className="absolute inset-0 rounded-none bg-zinc-200" />
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 grid place-items-center bg-white text-sm text-zinc-500">
          Could not render page {pageNumber}
        </div>
      ) : null}
    </div>
  );
}

export function PdfViewer({ src, fileName, onClose }: PdfViewerProps) {
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [baseScale, setBaseScale] = useState(1);
  const name = displayPdfFileName(fileName);

  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    setPdf(null);
    setLoadError(null);

    const run = async () => {
      const data = await fetchPdfArrayBuffer(src);
      doc = await getDocument({ data }).promise;
      if (cancelled) {
        await doc.destroy();
        return;
      }
      const page = await doc.getPage(1);
      const unscaled = page.getViewport({ scale: 1 });
      const available = Math.min(window.innerWidth - 48, 960);
      const fit = available / unscaled.width;
      setBaseScale(Math.min(Math.max(fit, 0.4), 1.6));
      setPdf(doc);
    };

    void run().catch((err: Error & { status?: number }) => {
      if (!cancelled) {
        setLoadError(
          err?.status === 401 || err?.status === 403 || /session expired/i.test(err?.message || "")
            ? "Session expired, please log in again."
            : "Could not open this PDF.",
        );
      }
    });

    return () => {
      cancelled = true;
      void doc?.destroy();
    };
  }, [src]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const bumpZoom = useCallback((delta: number) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
  }, []);

  const scale = baseScale * (zoom / 100);
  const pageCount = pdf?.numPages ?? 0;

  const overlay = (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-zinc-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={name}
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-zinc-950 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Paperclip className="h-4 w-4 shrink-0 text-zinc-300" aria-hidden />
          <span className="truncate text-sm font-medium tracking-tight">{name}</span>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0 text-zinc-200 hover:bg-white/10 hover:text-white"
          onClick={onClose}
          aria-label="Close PDF viewer"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="relative min-h-0 flex-1 bg-zinc-200">
        <div className="pointer-events-none absolute right-2 top-2 z-10 sm:right-4 sm:top-4">
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-zinc-300 bg-white/95 px-1 py-1 text-zinc-800 shadow-md sm:gap-1 sm:px-1.5">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-zinc-700"
              onClick={() => bumpZoom(-ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-[3.25rem] text-center text-xs font-medium tabular-nums">{zoom}%</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-zinc-700"
              onClick={() => bumpZoom(ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-1.5 text-xs text-zinc-700 sm:px-2"
              onClick={() => setZoom(DEFAULT_ZOOM)}
              aria-label="Reset zoom"
            >
              <RotateCcw className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>
        </div>

        <div
          ref={setScrollEl}
          className="h-full overflow-auto overscroll-contain px-3 pb-6 pt-14 sm:px-8 sm:pb-8 sm:pt-16"
        >
          {loadError ? (
            <p className="py-24 text-center text-sm text-zinc-600">{loadError}</p>
          ) : !pdf ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-zinc-500">
              <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading PDF" />
              <span className="text-sm">Loading document…</span>
            </div>
          ) : (
            <div className="mx-auto flex w-max min-w-full max-w-none flex-col items-center gap-4">
              {Array.from({ length: pageCount }, (_, i) => (
                <PdfViewerPage
                  key={i + 1}
                  pdf={pdf}
                  pageNumber={i + 1}
                  scale={scale}
                  root={scrollEl}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}

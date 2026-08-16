import { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchPdfArrayBuffer, getDocument } from "@/lib/pdfjs";

type PdfPageThumbnailProps = {
  src: string;
  title?: string;
  className?: string;
};

/**
 * Renders page 1 of a PDF onto a canvas as a thumbnail.
 * Shows a spinner while loading and a PDF icon if rendering fails.
 */
export function PdfPageThumbnail({ src, title, className }: PdfPageThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !src) return;

    setStatus("loading");

    const run = async () => {
      const data = await fetchPdfArrayBuffer(src);
      const loadingTask = getDocument({ data });
      const pdf = await loadingTask.promise;
      try {
        if (cancelled) return;
        const page = await pdf.getPage(1);
        const unscaled = page.getViewport({ scale: 1 });
        const maxWidth = box?.clientWidth || 640;
        const maxHeight = box?.clientHeight || 256;
        const scale = Math.min(maxWidth / unscaled.width, maxHeight / unscaled.height, 2);
        const viewport = page.getViewport({ scale: Math.max(scale, 0.25) });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setStatus("ready");
      } finally {
        await pdf.destroy();
      }
    };

    void run().catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div
      ref={boxRef}
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-md border border-border/60 bg-white",
        className,
      )}
    >
      {status === "loading" && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-white/80">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading PDF preview" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted/40 text-muted-foreground">
          <FileText className="h-12 w-12" aria-hidden />
          <span className="text-xs">PDF preview unavailable</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        title={title || "PDF first page"}
        className={cn(
          "max-h-full max-w-full object-contain",
          status === "ready" ? "visible" : "invisible",
        )}
      />
    </div>
  );
}

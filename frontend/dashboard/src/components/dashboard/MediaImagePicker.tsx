import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type MediaImagePickerProps = {
  label?: string;
  hint?: string;
  value?: string;
  aspect?: "video" | "square";
  onChange: (previewUrl: string, file?: File) => void;
  onClear?: () => void;
};

async function cropImage(
  file: File,
  aspect: "video" | "square",
): Promise<{ blob: Blob; preview: string }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = URL.createObjectURL(file);
  });

  const targetRatio = aspect === "square" ? 1 : 16 / 9;
  const srcRatio = img.width / img.height;
  let sw = img.width;
  let sh = img.height;
  let sx = 0;
  let sy = 0;

  if (srcRatio > targetRatio) {
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }

  const canvas = document.createElement("canvas");
  canvas.width = aspect === "square" ? 800 : 1280;
  canvas.height = aspect === "square" ? 800 : 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/jpeg", 0.92);
  });
  return { blob, preview: URL.createObjectURL(blob) };
}

/** Image picker with live preview — used for courses, events, and blogs. */
export function MediaImagePicker({
  label = "Cover image",
  hint = "One image. Cropped before upload.",
  value,
  aspect = "video",
  onChange,
  onClear,
}: MediaImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setBusy(true);
    try {
      const { blob, preview } = await cropImage(file, aspect);
      const cropped = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
      onChange(preview, cropped);
    } catch {
      // Crop can fail on HEIC / exotic formats — still upload the original file.
      const preview = URL.createObjectURL(file);
      onChange(preview, file);
      toast.message("Using original image (auto-crop unavailable)");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 overflow-hidden rounded-lg border border-border/60 bg-muted/30">
        <div className={`relative w-full ${aspect === "square" ? "aspect-square" : "aspect-video"}`}>
          {value ? (
            <>
              <img src={value} alt="Preview" className="h-full w-full object-cover" />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-2 top-2 h-8 w-8"
                onClick={() => {
                  onClear?.();
                  onChange("", undefined);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-muted/50"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="h-8 w-8" />
              {busy ? "Processing…" : "Upload image"}
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {value && (
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => inputRef.current?.click()}>
          Replace image
        </Button>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

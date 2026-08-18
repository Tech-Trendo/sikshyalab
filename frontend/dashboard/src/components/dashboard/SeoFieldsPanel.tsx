import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MediaImagePicker } from "@/components/dashboard/MediaImagePicker";
import { cn } from "@/lib/utils";

export const META_DESCRIPTION_SOFT_MAX = 160;

export type SeoFieldsValue = {
  metaTitle: string;
  metaDescription: string;
  ogImage?: string;
};

export function SeoFieldsPanel({
  value,
  onChange,
  onOgFile,
  titleFallback,
  coverFallbackHint = true,
  disabled,
}: {
  value: SeoFieldsValue;
  onChange: (next: SeoFieldsValue) => void;
  onOgFile?: (file: File | undefined) => void;
  titleFallback?: string;
  coverFallbackHint?: boolean;
  disabled?: boolean;
}) {
  const descLen = value.metaDescription.length;
  const over = descLen > META_DESCRIPTION_SOFT_MAX;

  return (
    <div className="grid gap-3">
      <div>
        <Label htmlFor="seo-meta-title">Meta Title</Label>
        <Input
          id="seo-meta-title"
          className="mt-1.5"
          value={value.metaTitle}
          disabled={disabled}
          placeholder={titleFallback?.trim() || "Falls back to the item title if empty"}
          onChange={(e) => onChange({ ...value, metaTitle: e.target.value })}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Optional. If empty, search engines will use the title.
        </p>
      </div>
      <div>
        <Label htmlFor="seo-meta-description">Meta Description</Label>
        <Textarea
          id="seo-meta-description"
          className="mt-1.5"
          rows={3}
          value={value.metaDescription}
          disabled={disabled}
          placeholder="Optional 150–160 character summary for search results"
          onChange={(e) => onChange({ ...value, metaDescription: e.target.value })}
        />
        <p className={cn("mt-1 text-[11px]", over ? "font-medium text-destructive" : "text-muted-foreground")}>
          {descLen}/{META_DESCRIPTION_SOFT_MAX}
          {over ? " — over the recommended length for search snippets" : " characters (optional)"}
        </p>
      </div>
      <MediaImagePicker
        label="OG Image (optional)"
        hint={
          coverFallbackHint
            ? "Optional. Leave empty to fall back to the cover/featured image automatically. Does not block save."
            : "Optional. Leave empty if you do not want a custom social preview image."
        }
        value={value.ogImage}
        onChange={(url, file) => {
          onChange({ ...value, ogImage: url });
          onOgFile?.(file);
        }}
        onClear={() => {
          onChange({ ...value, ogImage: "" });
          onOgFile?.(undefined);
        }}
      />
    </div>
  );
}

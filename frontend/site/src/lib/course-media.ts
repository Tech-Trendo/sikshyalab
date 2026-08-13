/**
 * Course thumbnail helpers for the public site.
 * Empty / null API thumbnails must NOT be replaced with a “real-looking” stock photo
 * that makes every card look identical.
 */

import { resolveMediaUrl } from "@/lib/env";

/** Neutral local placeholder — only used when the course has no thumbnail. */
export const COURSE_THUMBNAIL_PLACEHOLDER = "/images/theme/course-placeholder.svg";

/** Detect legacy hardcoded stock covers so we don’t treat them as real uploads. */
const LEGACY_STOCK_COVERS = [
  "/images/theme/programming-banner.webp",
  "images.unsplash.com/photo-1517430816045-df4b7de11d1d",
  "/cms/placeholders/missing.png",
];

export function isStockCourseCover(url?: string | null): boolean {
  if (!url) return true;
  return LEGACY_STOCK_COVERS.some((s) => url.includes(s));
}

/**
 * Resolve API thumbnail for display.
 * Returns "" when missing so UI can show an explicit placeholder state.
 * Appends ?v= for cache-busting when `version` (e.g. updated_at) is provided.
 */
export function resolveCourseThumbnail(
  thumbnail?: string | null,
  version?: string | number | null,
): string {
  const resolved = resolveMediaUrl(thumbnail);
  if (!resolved || isStockCourseCover(resolved)) return "";

  if (version == null || version === "") return resolved;
  const v = encodeURIComponent(String(version));
  return resolved.includes("?") ? `${resolved}&v=${v}` : `${resolved}?v=${v}`;
}

/** Final src for <img>/<Image>: real URL or placeholder. */
export function courseThumbnailSrc(thumbnail?: string | null, version?: string | number | null): string {
  return resolveCourseThumbnail(thumbnail, version) || COURSE_THUMBNAIL_PLACEHOLDER;
}

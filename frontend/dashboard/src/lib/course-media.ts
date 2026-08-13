/**
 * Course thumbnail helpers for the dashboard.
 */

import { resolveMediaUrl } from "./media-url";

export const COURSE_THUMBNAIL_PLACEHOLDER = "/images/theme/course-placeholder.svg";

const LEGACY_STOCK_COVERS = [
  "/images/theme/programming-banner.webp",
  "images.unsplash.com/photo-1517430816045-df4b7de11d1d",
  "images.unsplash.com/photo-1498050108023-c5249f4df085",
];

export function isStockCourseCover(url?: string | null): boolean {
  if (!url) return true;
  return LEGACY_STOCK_COVERS.some((s) => url.includes(s));
}

export function resolveCourseThumbnail(
  thumbnail?: string | null,
  version?: string | number | null,
): string {
  const resolved = resolveMediaUrl(thumbnail);
  if (!resolved || isStockCourseCover(resolved)) return "";

  if (version == null || version === "") return resolved;
  // Never mutate SigV4 / S3 query strings — extra params invalidate the signature
  // (S3 returns XML → browser CORB on <img>).
  if (/[?&]X-Amz-(?:Algorithm|Signature)=/i.test(resolved)) return resolved;
  const v = encodeURIComponent(String(version));
  return resolved.includes("?") ? `${resolved}&v=${v}` : `${resolved}?v=${v}`;
}

export function courseThumbnailSrc(
  thumbnail?: string | null,
  version?: string | number | null,
): string {
  return resolveCourseThumbnail(thumbnail, version) || COURSE_THUMBNAIL_PLACEHOLDER;
}

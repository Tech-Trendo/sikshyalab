import { slugify } from "@/lib/dashboard-utils";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Normalize user input into a URL-safe course slug. */
export function normalizeCourseSlug(raw: string, fallbackTitle?: string): string {
  const base = (raw || fallbackTitle || "").trim().toLowerCase();
  if (!base) return "";
  return slugify(base);
}

export function isValidCourseSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function courseSlugError(slug: string): string | null {
  const normalized = normalizeCourseSlug(slug);
  if (!normalized) return "Slug is required";
  if (!isValidCourseSlug(normalized)) {
    return "Use lowercase letters, numbers, and hyphens only (no spaces).";
  }
  return null;
}

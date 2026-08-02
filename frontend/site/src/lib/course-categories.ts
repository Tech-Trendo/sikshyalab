import type { Course } from "@/lib/mock";

/** Category names on a course (supports multi-category). */
export function courseCategoryNames(course: {
  category?: string;
  categories?: string[];
}): string[] {
  if (Array.isArray(course.categories) && course.categories.length) {
    return course.categories.filter(Boolean);
  }
  return course.category ? [course.category] : [];
}

export type CourseCategoryGroup<T> = {
  category: string;
  courses: T[];
};

/**
 * Group courses under category headings.
 * - `mode: "all"` — a course appears under every category it belongs to (nav / browse).
 * - `mode: "primary"` — a course appears once under its first category (admin lists).
 */
export function groupCoursesByCategory<
  T extends { category?: string; categories?: string[]; title?: string },
>(
  courses: T[],
  options?: {
    mode?: "all" | "primary";
    /** Preferred category order (e.g. CMS category list). */
    categoryOrder?: string[];
  },
): CourseCategoryGroup<T>[] {
  const mode = options?.mode ?? "primary";
  const map = new Map<string, T[]>();

  for (const course of courses) {
    const names = courseCategoryNames(course);
    const keys = mode === "all" ? names : names.slice(0, 1);
    const targets = keys.length ? keys : ["Uncategorized"];
    for (const name of targets) {
      const list = map.get(name) || [];
      if (!list.includes(course)) list.push(course);
      map.set(name, list);
    }
  }

  const order = options?.categoryOrder?.length
    ? options.categoryOrder
    : [...map.keys()].sort((a, b) => a.localeCompare(b));

  const seen = new Set<string>();
  const groups: CourseCategoryGroup<T>[] = [];

  for (const name of order) {
    const list = map.get(name);
    if (!list?.length) continue;
    seen.add(name);
    groups.push({ category: name, courses: list });
  }

  for (const [name, list] of map) {
    if (seen.has(name) || !list.length) continue;
    groups.push({ category: name, courses: list });
  }

  return groups;
}

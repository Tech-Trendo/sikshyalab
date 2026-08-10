/**
 * Canonical API path builders for the dashboard.
 * Paths are relative to VITE_API_URL (default `/api/v1`).
 * Always include trailing slashes — Django APPEND_SLASH cannot preserve POST bodies.
 */

function withSlash(path: string): string {
  if (!path) return "/";
  const [pathname, query] = path.split("?");
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return query ? `${normalized}?${query}` : normalized;
}

export const batchEndpoints = {
  list: () => withSlash("/batches/batches"),
  detail: (id: string) => withSlash(`/batches/batches/${encodeURIComponent(id)}`),
  shifts: () => withSlash("/batches/shifts"),
};

export const courseEndpoints = {
  list: () => withSlash("/courses/courses"),
  detail: (slug: string) => withSlash(`/courses/courses/${encodeURIComponent(slug)}`),
  publish: (slug: string) => withSlash(`/courses/courses/${encodeURIComponent(slug)}/publish`),
  unpublish: (slug: string) => withSlash(`/courses/courses/${encodeURIComponent(slug)}/unpublish`),
  seo: (slug: string) => withSlash(`/courses/courses/${encodeURIComponent(slug)}/seo`),
  uploadThumbnail: (slug: string) =>
    withSlash(`/courses/courses/${encodeURIComponent(slug)}/upload-thumbnail`),
  featured: () => withSlash("/courses/courses/featured"),
  categories: () => withSlash("/courses/categories"),
  categoryDetail: (slug: string) => withSlash(`/courses/categories/${encodeURIComponent(slug)}`),
  instructors: () => withSlash("/courses/instructors"),
};

export const teacherEndpoints = {
  list: () => withSlash("/teachers/profiles"),
  detail: (id: string) => withSlash(`/teachers/profiles/${encodeURIComponent(id)}`),
  assignCourses: (id: string) =>
    withSlash(`/teachers/profiles/${encodeURIComponent(id)}/assign-courses`),
};

export const contentEndpoints = {
  resources: () => withSlash("/content/resources"),
  resourceDetail: (id: string) => withSlash(`/content/resources/${encodeURIComponent(id)}`),
};

/** Public site path for a course (not an API URL). */
export function coursePublicPath(slug: string): string {
  return `/courses/${slug}`;
}

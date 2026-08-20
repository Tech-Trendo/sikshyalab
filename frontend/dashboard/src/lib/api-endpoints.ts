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

export const assignmentEndpoints = {
  list: () => withSlash("/assignments/assignments"),
  detail: (id: string) => withSlash(`/assignments/assignments/${encodeURIComponent(id)}`),
  submissions: () => withSlash("/assignments/submissions"),
  submittedStudents: (id: string) =>
    withSlash(`/assignments/assignments/${encodeURIComponent(id)}/submitted-students`),
  missedStudents: (id: string) =>
    withSlash(`/assignments/assignments/${encodeURIComponent(id)}/missed-students`),
  gradeSubmission: (id: string) =>
    withSlash(`/assignments/submissions/${encodeURIComponent(id)}/grade`),
  submissionDownload: (id: string) =>
    withSlash(`/assignments/submissions/${encodeURIComponent(id)}/download`),
};

export const contentEndpoints = {
  blogPostSections: (postId: string | number) =>
    withSlash(`/content/blog-posts/${encodeURIComponent(String(postId))}/sections`),
  blogSectionDetail: (sectionId: string | number) =>
    withSlash(`/content/blog-sections/${encodeURIComponent(String(sectionId))}`),
  resources: () => withSlash("/content/resources"),
  resourceDetail: (id: string) => withSlash(`/content/resources/${encodeURIComponent(id)}`),
  resourceStream: (id: string) =>
    withSlash(`/content/resources/${encodeURIComponent(id)}/stream`),
  resourceTimestamps: (id: string) =>
    withSlash(`/content/resources/${encodeURIComponent(id)}/timestamps`),
  resourceTimestampDetail: (resourceId: string, timestampId: string) =>
    withSlash(
      `/content/resources/${encodeURIComponent(resourceId)}/timestamps/${encodeURIComponent(timestampId)}`,
    ),
};

export const rolesEndpoints = {
  permissions: () => withSlash("/roles/permissions"),
  roles: () => withSlash("/roles/roles"),
  roleDetail: (id: string | number) => withSlash(`/roles/roles/${encodeURIComponent(String(id))}`),
  rolePermissions: (role: string | number) =>
    withSlash(`/roles/${encodeURIComponent(String(role))}/permissions`),
  assignPermissions: (id: string | number) =>
    withSlash(`/roles/roles/${encodeURIComponent(String(id))}/assign-permissions`),
  userPermissions: (userId: string | number) =>
    withSlash(`/users/${encodeURIComponent(String(userId))}/permissions`),
  /** Self-service: effective permissions for the logged-in user (any role). */
  currentUserPermissions: () => withSlash("/users/me/permissions"),
  userRolesForUser: (userId: string | number) =>
    withSlash(`/roles/user-roles/?user=${encodeURIComponent(String(userId))}`),
};

/** Public site path for a course (not an API URL). */
export function coursePublicPath(slug: string): string {
  return `/courses/${slug}`;
}

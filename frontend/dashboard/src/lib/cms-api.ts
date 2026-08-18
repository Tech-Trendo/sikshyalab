/**
 * CMS API client — testimonials, reviews, blog, events, FAQs.
 */

import { getAccessToken, refreshAccessToken } from "./api";
import { resolveApiBase } from "./api-base";
import { resolveMediaUrl } from "./media-url";

const API_BASE = resolveApiBase();

function headers(): HeadersInit {
  const token = getAccessToken();
  const h: HeadersInit = { Accept: "application/json", "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parseBody<T>(res: Response): Promise<T | null> {
  try {
    const body = await res.json();
    if (body && typeof body === "object" && "data" in body) return body.data as T;
    return body as T;
  } catch {
    return null;
  }
}

function extractError(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const errors = b.errors;
    if (errors && typeof errors === "object" && !Array.isArray(errors)) {
      for (const [key, val] of Object.entries(errors as Record<string, unknown>)) {
        if (Array.isArray(val) && val[0]) return `${key}: ${String(val[0])}`;
        if (typeof val === "string") return `${key}: ${val}`;
      }
    }
    if (Array.isArray(errors) && errors[0]) return String(errors[0]);
    if (typeof b.detail === "string") return b.detail;
    if (typeof b.message === "string" && b.message !== "Validation failed") return b.message;
    if (typeof b.message === "string") return b.message;
    for (const key of Object.keys(b)) {
      const val = b[key];
      if (Array.isArray(val) && val[0]) return `${key}: ${String(val[0])}`;
      if (typeof val === "string") return `${key}: ${val}`;
    }
  }
  if (status === 401) return "Session expired — please sign in again.";
  if (status === 403) return "You do not have permission to upload.";
  if (status === 413) return "Image is too large.";
  return `Upload failed (${status})`;
}

async function cmsFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const REQUEST_TIMEOUT_MS = 15000;
  const buildHeaders = (token: string | null, extra?: HeadersInit): Record<string, string> => {
    const h: Record<string, string> = { Accept: "application/json" };
    if (extra) {
      new Headers(extra).forEach((value, key) => {
        // Skip auth from callers — we set it from the live token below
        if (key.toLowerCase() === "authorization") return;
        h[key] = value;
      });
    }
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };

  try {
    let token = getAccessToken();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res = await fetch(`${API_BASE}/cms${path}`, {
      credentials: "include",
      ...init,
      headers: buildHeaders(token, init?.headers),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (res.status === 401) {
      const next = await refreshAccessToken();
      if (next) {
        token = next;
        const controller2 = new AbortController();
        const t2 = setTimeout(() => controller2.abort(), REQUEST_TIMEOUT_MS);
        res = await fetch(`${API_BASE}/cms${path}`, {
          credentials: "include",
          ...init,
          headers: buildHeaders(token, init?.headers),
          signal: controller2.signal,
        });
        clearTimeout(t2);
      }
      // Public CMS reads work without auth — retry bare if still unauthorized
      if (res.status === 401 && (!init?.method || init.method === "GET" || init.method === "HEAD")) {
        const controller3 = new AbortController();
        const t3 = setTimeout(() => controller3.abort(), REQUEST_TIMEOUT_MS);
        res = await fetch(`${API_BASE}/cms${path}`, {
          credentials: "include",
          ...init,
          headers: { Accept: "application/json" },
          signal: controller3.signal,
        });
        clearTimeout(t3);
      }
    }
    return res;
  } catch {
    return null;
  }
}

async function cmsList<T>(path: string): Promise<T[]> {
  try {
    const join = path.includes("?") ? "&" : "?";
    const all: T[] = [];
    let page = 1;
    const pageSize = 100;
    for (let guard = 0; guard < 50; guard += 1) {
      const res = await cmsFetch(`${path}${join}page=${page}&page_size=${pageSize}`, {
        headers: headers(),
      });
      if (!res || !res.ok) return all;
      const raw = await res.json().catch(() => null);
      if (!raw || typeof raw !== "object") break;
      const envelope = raw as Record<string, unknown>;
      const data = ("data" in envelope ? envelope.data : raw) as unknown;
      const meta = envelope.meta as { total_pages?: number; next?: string | null } | undefined;
      let rows: T[] = [];
      if (Array.isArray(data)) rows = data;
      else if (data && typeof data === "object" && Array.isArray((data as { results?: T[] }).results)) {
        rows = (data as { results: T[] }).results;
      }
      all.push(...rows);
      const totalPages = meta?.total_pages ? Number(meta.total_pages) || 1 : rows.length < pageSize ? page : page + 1;
      if (page >= totalPages || rows.length === 0) break;
      page += 1;
    }
    return all;
  } catch {
    return [];
  }
}

async function cmsGet<T>(path: string): Promise<T | null> {
  try {
    const res = await cmsFetch(path, { headers: headers() });
    if (!res || !res.ok) return null;
    return parseBody<T>(res);
  } catch {
    return null;
  }
}

async function cmsMutate<T>(path: string, method: string, body?: unknown): Promise<T | null> {
  const result = await cmsMutateDetailed<T>(path, method, body);
  return result.ok ? result.data : null;
}

async function cmsMutateDetailed<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<CmsFormResult<T>> {
  if (!getAccessToken()) {
    return { ok: false, error: "Not signed in — open the site login, then return to the dashboard." };
  }
  try {
    const res = await cmsFetch(path, {
      method,
      headers: headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res) return { ok: false, error: "Network error — is the API running on :8000?" };
    const raw = await res.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      return { ok: false, error: extractError(parsed, res.status), status: res.status };
    }
    const data =
      parsed && typeof parsed === "object" && "data" in parsed
        ? ((parsed as { data: T }).data as T)
        : (parsed as T);
    if (!data) return { ok: false, error: "Empty response from server" };
    return { ok: true, data: withResolvedMedia(data as T & { image?: string | null }) };
  } catch {
    return { ok: false, error: "Network error — is the API running on :8000?" };
  }
}

export type CmsFormResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

async function cmsFormMutate<T>(path: string, method: string, form: FormData): Promise<CmsFormResult<T>> {
  if (!getAccessToken()) {
    return { ok: false, error: "Not signed in — open the site login, then return to the dashboard." };
  }
  try {
    const res = await cmsFetch(path, {
      method,
      body: form,
      // Do NOT set Content-Type — browser sets multipart boundary
      headers: { Accept: "application/json" },
    });
    if (!res) return { ok: false, error: "Network error — is the API running on :8000?" };
    const raw = await res.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      return { ok: false, error: extractError(parsed, res.status), status: res.status };
    }
    const data =
      parsed && typeof parsed === "object" && "data" in parsed
        ? ((parsed as { data: T }).data as T)
        : (parsed as T);
    if (!data) return { ok: false, error: "Empty response from server" };
    return { ok: true, data: withResolvedMedia(data as T & { image?: string | null }) };
  } catch {
    return { ok: false, error: "Network error — is the API running on :8000?" };
  }
}

function withResolvedMedia<T extends { image?: string | null; logo?: string | null; cover_image?: string | null; og_image?: string | null; featured_image?: string | null; avatar?: string | null }>(
  row: T,
): T {
  const next = { ...row };
  if ("image" in next && next.image) next.image = resolveMediaUrl(next.image);
  if ("logo" in next && next.logo) next.logo = resolveMediaUrl(next.logo);
  if ("cover_image" in next && next.cover_image) next.cover_image = resolveMediaUrl(next.cover_image);
  if ("og_image" in next && next.og_image) next.og_image = resolveMediaUrl(next.og_image);
  if ("featured_image" in next && next.featured_image) {
    next.featured_image = resolveMediaUrl(next.featured_image);
  }
  if ("avatar" in next && next.avatar) next.avatar = resolveMediaUrl(next.avatar);
  return next;
}

/** FAQ sections available in admin create/edit dropdowns. */
export const FAQ_SECTIONS = [
  "General Questions",
  "Community",
  "Support",
  "Admissions",
  "Certificates",
  "Batches",
  "Careers",
  "Learning",
] as const;

export type CmsTestimonial = {
  id: string | number;
  name: string;
  role: string;
  organization: string;
  content: string;
  rating: number;
  is_featured: boolean;
  is_published: boolean;
  order: number;
  source_review_id?: string | number | null;
};

export type CmsCourseReview = {
  id: string | number;
  student_name: string;
  student_email: string;
  course_name: string;
  rating: number;
  content: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  testimonial_id?: string | number | null;
  is_promoted?: boolean;
  created_at?: string;
};

export type CmsFaq = {
  id: string | number;
  question: string;
  answer: string;
  category?: string;
  order: number;
  is_published: boolean;
};

export type CmsBlogSection = {
  id?: string;
  blog_post?: string;
  title?: string | null;
  description: string;
  order?: number;
  created_at?: string;
  updated_at?: string;
};

export type CmsBlogPost = {
  id: string | number;
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  author?: number | null;
  author_name?: string;
  cover_image?: string | null;
  category?: string;
  tags?: unknown;
  is_published: boolean;
  published_at?: string | null;
  views_count?: number;
  order?: number;
  meta_title?: string | null;
  meta_description?: string | null;
  og_image?: string | null;
  sections?: CmsBlogSection[];
};

/** Nested JSON fields (sections, highlights) must not be String()-coerced. */
export function appendPayloadToForm(form: FormData, payload: Record<string, unknown>) {
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      form.append(key, String(value));
      continue;
    }
    form.append(key, JSON.stringify(value));
  }
}

export type CmsEvent = {
  id: string | number;
  title: string;
  slug: string;
  description?: string;
  location: string;
  course?: string | null;
  course_title?: string | null;
  course_slug?: string | null;
  start_datetime: string;
  end_datetime?: string | null;
  cover_image?: string | null;
  is_published: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  og_image?: string | null;
};

export type CmsHomepageFeature = {
  title: string;
  description: string;
  image: string;
};

export type CmsSiteSetting = {
  id: string | number;
  site_name: string;
  tagline?: string;
  logo?: string | null;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  social_links?: Record<string, string>;
  footer_text?: string;
  features_eyebrow?: string;
  features_heading?: string;
  homepage_features?: CmsHomepageFeature[];
  testimonials_eyebrow?: string;
  testimonials_heading?: string;
  is_published?: boolean;
};

export type CmsBanner = {
  id: string | number;
  title: string;
  subtitle?: string;
  image?: string | null;
  mobile_image?: string | null;
  cta_text?: string;
  cta_url?: string;
  placement?: string;
  is_active?: boolean;
  is_published?: boolean;
  order?: number;
};

export type CmsPage = {
  id: string | number;
  title: string;
  slug: string;
  content?: string;
  page_type?: "HOME" | "ABOUT" | "CONTACT" | "CUSTOM" | string;
  featured_image?: string | null;
  is_published?: boolean;
  order?: number;
};

export type CmsEventRegistration = {
  id: string | number;
  event: string | number;
  event_title: string;
  event_slug: string;
  event_location?: string;
  event_start_datetime?: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approved_at?: string | null;
  details_emailed_at?: string | null;
  created_at?: string;
};

export type CmsContactMessage = {
  id: string | number;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status?: "PENDING" | "CONTACTED" | "CONVERTED" | "LOST";
  is_read: boolean;
  replied_at?: string | null;
  created_at?: string;
};

export type CmsGalleryItem = {
  id: string | number;
  title: string;
  image?: string | null;
  category?: string;
  event?: string | number | null;
  event_title?: string;
  event_slug?: string;
  course_slug?: string;
  course_title?: string;
  order?: number;
  is_published?: boolean;
};

export type CmsPartner = {
  id: string | number;
  name?: string;
  logo?: string | null;
  website_url?: string;
  order?: number;
  is_published?: boolean;
};

export type CmsAnnouncement = {
  id: string | number;
  title: string;
  content: string;
  priority?: string;
  audience?: string;
  is_published?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  order?: number;
};

export const cmsApi = {
  listTestimonials: () => cmsList<CmsTestimonial>("/testimonials/"),
  createTestimonial: (payload: Partial<CmsTestimonial>) =>
    cmsMutate<CmsTestimonial>("/testimonials/", "POST", payload),
  updateTestimonial: (id: string | number, payload: Partial<CmsTestimonial>) =>
    cmsMutate<CmsTestimonial>(`/testimonials/${id}/`, "PATCH", payload),
  deleteTestimonial: (id: string | number) => cmsMutate<void>(`/testimonials/${id}/`, "DELETE"),

  listReviews: () => cmsList<CmsCourseReview>("/reviews/"),
  createReview: (payload: {
    student_name: string;
    student_email?: string;
    course_name: string;
    rating: number;
    content: string;
  }) => cmsMutate<CmsCourseReview>("/reviews/", "POST", payload),
  updateReview: (id: string | number, payload: Partial<CmsCourseReview>) =>
    cmsMutate<CmsCourseReview>(`/reviews/${id}/`, "PATCH", payload),
  promoteReview: (id: string | number) =>
    cmsMutate<{ review: CmsCourseReview; testimonial: CmsTestimonial }>(
      `/reviews/${id}/promote-to-testimonial/`,
      "POST",
      {},
    ),
  exportReviewsToTestimonials: (payload?: { review_ids?: Array<string | number>; only_approved?: boolean }) =>
    cmsMutate<{ count: number }>("/reviews/export-to-testimonials/", "POST", payload ?? { only_approved: true }),

  listFaqs: () => cmsList<CmsFaq>("/faqs/"),
  createFaq: (payload: Partial<CmsFaq>) => cmsMutate<CmsFaq>("/faqs/", "POST", payload),
  updateFaq: (id: string | number, payload: Partial<CmsFaq>) =>
    cmsMutate<CmsFaq>(`/faqs/${id}/`, "PATCH", payload),

  listBlogPosts: async () => {
    const rows = await cmsList<CmsBlogPost>("/blog/");
    return rows.map((r) => withResolvedMedia(r));
  },
  getBlogPost: async (slug: string) => {
    const row = await cmsGet<CmsBlogPost>(`/blog/${slug}/`);
    return row ? withResolvedMedia(row) : null;
  },
  updateBlogPost: (slug: string, payload: Partial<CmsBlogPost>) =>
    cmsMutate<CmsBlogPost>(`/blog/${slug}/`, "PATCH", payload),
  createBlogPost: (payload: Partial<CmsBlogPost>) =>
    cmsMutateDetailed<CmsBlogPost>("/blog/", "POST", payload),
  createBlogPostForm: (form: FormData) => cmsFormMutate<CmsBlogPost>("/blog/", "POST", form),
  updateBlogPostForm: (slug: string, form: FormData) =>
    cmsFormMutate<CmsBlogPost>(`/blog/${slug}/`, "PATCH", form),

  listEvents: async () => {
    const rows = await cmsList<CmsEvent>("/events/");
    return rows.map((r) => withResolvedMedia(r));
  },
  createEvent: (payload: Partial<CmsEvent>) => cmsMutate<CmsEvent>("/events/", "POST", payload),
  updateEvent: (slug: string, payload: Partial<CmsEvent>) =>
    cmsMutate<CmsEvent>(`/events/${slug}/`, "PATCH", payload),
  createEventForm: (form: FormData) => cmsFormMutate<CmsEvent>("/events/", "POST", form),
  updateEventForm: (slug: string, form: FormData) =>
    cmsFormMutate<CmsEvent>(`/events/${slug}/`, "PATCH", form),

  getSiteSettings: async () => {
    const row = await cmsGet<CmsSiteSetting>("/settings/current/");
    return row ? withResolvedMedia(row) : null;
  },
  listSiteSettings: async () => {
    const rows = await cmsList<CmsSiteSetting>("/settings/");
    return rows.map((r) => withResolvedMedia(r));
  },
  updateSiteSetting: (id: string | number, payload: Partial<CmsSiteSetting>) =>
    cmsMutate<CmsSiteSetting>(`/settings/${id}/`, "PATCH", payload),
  updateSiteSettingForm: (id: string | number, form: FormData) =>
    cmsFormMutate<CmsSiteSetting>(`/settings/${id}/`, "PATCH", form),
  createSiteSetting: (payload: Partial<CmsSiteSetting>) =>
    cmsMutate<CmsSiteSetting>("/settings/", "POST", payload),
  createSiteSettingForm: (form: FormData) => cmsFormMutate<CmsSiteSetting>("/settings/", "POST", form),

  listGallery: async () => {
    const rows = await cmsList<CmsGalleryItem>("/gallery/");
    return rows.map((r) => withResolvedMedia(r));
  },
  createGalleryItemForm: (form: FormData) => cmsFormMutate<CmsGalleryItem>("/gallery/", "POST", form),
  updateGalleryItem: (id: string | number, payload: Partial<CmsGalleryItem>) =>
    cmsMutate<CmsGalleryItem>(`/gallery/${id}/`, "PATCH", payload),
  updateGalleryItemForm: (id: string | number, form: FormData) =>
    cmsFormMutate<CmsGalleryItem>(`/gallery/${id}/`, "PATCH", form),
  deleteGalleryItem: (id: string | number) => cmsMutate<void>(`/gallery/${id}/`, "DELETE"),

  listPartners: async () => {
    const rows = await cmsList<CmsPartner>("/partners/");
    return rows.map((r) => withResolvedMedia(r));
  },
  createPartnerForm: (form: FormData) => cmsFormMutate<CmsPartner>("/partners/", "POST", form),
  updatePartner: (id: string | number, payload: Partial<CmsPartner>) =>
    cmsMutate<CmsPartner>(`/partners/${id}/`, "PATCH", payload),
  updatePartnerForm: (id: string | number, form: FormData) =>
    cmsFormMutate<CmsPartner>(`/partners/${id}/`, "PATCH", form),
  deletePartner: (id: string | number) => cmsMutate<void>(`/partners/${id}/`, "DELETE"),

  listAnnouncements: () => cmsList<CmsAnnouncement>("/announcements/"),
  createAnnouncement: (payload: Partial<CmsAnnouncement>) =>
    cmsMutate<CmsAnnouncement>("/announcements/", "POST", payload),
  updateAnnouncement: (id: string | number, payload: Partial<CmsAnnouncement>) =>
    cmsMutate<CmsAnnouncement>(`/announcements/${id}/`, "PATCH", payload),
  deleteAnnouncement: (id: string | number) =>
    cmsMutate<void>(`/announcements/${id}/`, "DELETE"),

  listBanners: async () => {
    const rows = await cmsList<CmsBanner>("/banners/");
    return rows.map((r) => withResolvedMedia(r));
  },
  updateBanner: (id: string | number, payload: Partial<CmsBanner>) =>
    cmsMutate<CmsBanner>(`/banners/${id}/`, "PATCH", payload),
  updateBannerForm: (id: string | number, form: FormData) =>
    cmsFormMutate<CmsBanner>(`/banners/${id}/`, "PATCH", form),
  createBanner: (payload: Partial<CmsBanner>) => cmsMutate<CmsBanner>("/banners/", "POST", payload),
  createBannerForm: (form: FormData) => cmsFormMutate<CmsBanner>("/banners/", "POST", form),

  listPages: async (params?: { page_type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page_type) qs.set("page_type", params.page_type);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const rows = await cmsList<CmsPage>(`/pages/${suffix}`);
    return rows.map((r) => withResolvedMedia(r));
  },
  getPage: async (slug: string) => {
    const row = await cmsGet<CmsPage>(`/pages/${encodeURIComponent(slug)}/`);
    return row ? withResolvedMedia(row) : null;
  },
  createPage: (payload: Partial<CmsPage>) => cmsMutate<CmsPage>("/pages/", "POST", payload),
  updatePage: (slug: string, payload: Partial<CmsPage>) =>
    cmsMutate<CmsPage>(`/pages/${encodeURIComponent(slug)}/`, "PATCH", payload),
  updatePageForm: (slug: string, form: FormData) =>
    cmsFormMutate<CmsPage>(`/pages/${encodeURIComponent(slug)}/`, "PATCH", form),
  createPageForm: (form: FormData) => cmsFormMutate<CmsPage>("/pages/", "POST", form),

  listEventRegistrations: (params?: { status?: string; event_slug?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.event_slug) qs.set("event__slug", params.event_slug);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return cmsList<CmsEventRegistration>(`/event-registrations/${suffix}`);
  },
  approveEventRegistration: (id: string | number) =>
    cmsMutate<CmsEventRegistration>(`/event-registrations/${id}/approve/`, "POST", {}),
  rejectEventRegistration: (id: string | number) =>
    cmsMutate<CmsEventRegistration>(`/event-registrations/${id}/reject/`, "POST", {}),

  listContactMessages: () => cmsList<CmsContactMessage>("/contact-messages/"),
  setContactMessageStatus: (
    id: string | number,
    status: "PENDING" | "CONTACTED" | "CONVERTED" | "LOST",
  ) =>
    cmsMutate<CmsContactMessage>(`/contact-messages/${id}/set-status/`, "POST", { status }),
  markContactMessageRead: (id: string | number) =>
    cmsMutate<CmsContactMessage>(`/contact-messages/${id}/mark-read/`, "POST", {}),
  markContactMessageReplied: (id: string | number) =>
    cmsMutate<CmsContactMessage>(`/contact-messages/${id}/mark-replied/`, "POST", {}),
  deleteContactMessage: (id: string | number) =>
    cmsMutate<void>(`/contact-messages/${id}/`, "DELETE"),
};

export const cmsKeys = {
  testimonials: ["cms", "testimonials"] as const,
  reviews: ["cms", "reviews"] as const,
  faqs: ["cms", "faqs"] as const,
  blog: ["cms", "blog"] as const,
  events: ["cms", "events"] as const,
  eventRegistrations: ["cms", "event-registrations"] as const,
  settings: ["cms", "settings"] as const,
  banners: ["cms", "banners"] as const,
  contactMessages: ["cms", "contact-messages"] as const,
  pages: ["cms", "pages"] as const,
  gallery: ["cms", "gallery"] as const,
  partners: ["cms", "partners"] as const,
  announcements: ["cms", "announcements"] as const,
};

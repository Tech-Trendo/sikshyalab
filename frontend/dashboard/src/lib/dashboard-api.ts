/**
 * Dashboard API client — academics, analytics, SEO.
 * Falls back silently when backend/JWT is unavailable.
 */

import { getAccessToken } from "./api";
import { resolveApiBase } from "./api-base";
import { batchEndpoints, courseEndpoints } from "./api-endpoints";
import { cmsApi } from "./cms-api";

const API_BASE = resolveApiBase();

const REQUEST_TIMEOUT_MS = 15000;

function headers(): HeadersInit {
  const token = getAccessToken();
  const h: HeadersInit = { Accept: "application/json", "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parseBody<T>(res: Response): Promise<T | null> {
  try {
    const body = await res.json();
    // Standard envelope: { success, data, message, errors }
    if (body && typeof body === "object" && "data" in body && ("success" in body || "message" in body)) {
      return body.data as T;
    }
    return body as T;
  } catch {
    return null;
  }
}

function errorMessageFromBody(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.message === "string" && b.message) return b.message;
    if (typeof b.detail === "string" && b.detail) return b.detail;
    const errors = b.errors;
    if (errors && typeof errors === "object" && errors !== null && "detail" in errors) {
      const detail = (errors as { detail?: unknown }).detail;
      if (typeof detail === "string") return detail;
    }
  }
  return `Request failed (${status})`;
}

export async function apiList<T>(path: string): Promise<T[]> {
  if (!getAccessToken()) return [];
  try {
    const join = path.includes("?") ? "&" : "?";
    const all: T[] = [];
    let page = 1;
    const pageSize = 100;
    // Follow pagination until exhausted (backend default page_size is 20).
    for (let guard = 0; guard < 50; guard += 1) {
      const url = `${API_BASE}${path}${join}page=${page}&page_size=${pageSize}`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(url, { headers: headers(), signal: controller.signal, credentials: "include" });
      clearTimeout(t);
      if (!res.ok) return all.length ? all : [];
      const raw = await res.json().catch(() => null);
      let rows: T[] = [];
      let totalPages = 1;
      if (raw && typeof raw === "object") {
        const envelope = raw as Record<string, unknown>;
        const data = ("data" in envelope ? envelope.data : raw) as unknown;
        const meta = envelope.meta as
          | { total_pages?: number; next?: string | null }
          | undefined;
        if (Array.isArray(data)) rows = data;
        else if (data && typeof data === "object" && Array.isArray((data as { results?: T[] }).results)) {
          rows = (data as { results: T[] }).results;
        } else if (Array.isArray(raw)) {
          rows = raw as T[];
        }
        if (meta?.total_pages) totalPages = Number(meta.total_pages) || 1;
        else if (meta?.next) totalPages = page + 1;
        else if (rows.length < pageSize) totalPages = page;
      }
      all.push(...rows);
      if (page >= totalPages || rows.length === 0) break;
      page += 1;
    }
    return all;
  } catch {
    return [];
  }
}

async function apiGet<T>(path: string): Promise<T | null> {
  if (!getAccessToken()) return null;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(`${API_BASE}${path}`, { headers: headers(), signal: controller.signal, credentials: "include" });
    clearTimeout(t);
    if (!res.ok) return null;
    return parseBody<T>(res);
  } catch {
    return null;
  }
}

export type ApiMutateFailure = { data: null; error: string; status: number };

export async function apiMutate<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T | null> {
  const result = await apiMutateDetailed<T>(path, method, body);
  return result.data;
}

export async function apiMutateDetailed<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<{ data: T | null; error: string | null; status: number }> {
  if (!getAccessToken()) return { data: null, error: "Not authenticated", status: 0 };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers: headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(t);
    let raw: unknown = null;
    try {
      raw = await res.json();
    } catch {
      raw = null;
    }
    if (!res.ok) {
      return { data: null, error: errorMessageFromBody(raw, res.status), status: res.status };
    }
    // Re-wrap parsed body (already consumed as raw)
    if (raw && typeof raw === "object" && "data" in raw && ("success" in raw || "message" in raw)) {
      return { data: (raw as { data: T }).data, error: null, status: res.status };
    }
    return { data: raw as T, error: null, status: res.status };
  } catch {
    return { data: null, error: "Network error", status: 0 };
  }
}

export type ApiCategoryRow = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_active?: boolean;
  order?: number;
  course_count?: number;
  parent?: string | null;
  icon?: string;
};

/** Find a category by name (case-insensitive) or create it. */
export async function resolveOrCreateCategory(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = await apiList<ApiCategoryRow>(courseEndpoints.categories());
  const match = existing.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase() || c.slug === trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  );
  if (match?.id) return String(match.id);
  const created = await apiMutate<ApiCategoryRow>(courseEndpoints.categories(), "POST", {
    name: trimmed,
    is_active: true,
  });
  return created?.id ? String(created.id) : null;
}

// --- Profile shortcuts ---

export type ApiStudentProfile = {
  id: string;
  student_id: string;
  full_name?: string;
  status?: string;
  user?: {
    email?: string;
    phone?: string;
    avatar?: string | null;
    first_name?: string;
    last_name?: string;
    provisional_password?: string;
    must_change_password?: boolean;
  };
  admission_date?: string | null;
};

export type ApiTeacherProfile = {
  id: string;
  teacher_id?: string;
  full_name?: string;
  designation?: string;
  bio?: string;
  years_of_experience?: number | null;
  user?: { email?: string; phone?: string; avatar?: string | null; first_name?: string; last_name?: string };
  assigned_courses?: Array<{
    id: string;
    title: string;
    slug: string;
    is_primary?: boolean;
    assigned_at?: string | null;
  }>;
  assigned_course_ids?: string[];
  assigned_courses_count?: number;
};

export async function fetchStudentProfileMe(): Promise<ApiStudentProfile | null> {
  return apiGet<ApiStudentProfile>("/students/profiles/me/");
}

export async function fetchTeacherProfileMe(): Promise<ApiTeacherProfile | null> {
  return apiGet<ApiTeacherProfile>("/teachers/profiles/me/");
}

// --- Raw list types (partial) ---

export type ApiStudentRow = ApiStudentProfile;
export type ApiTeacherRow = ApiTeacherProfile & { status?: string };
export type ApiCourseRow = {
  id: string;
  slug: string;
  title: string;
  category?: string | null;
  category_name?: string | null;
  category_names?: string[];
  categories?: string[];
  level?: string;
  enrollment_type?: string;
  duration_weeks?: number | null;
  duration_hours?: number | null;
  price?: string | number;
  discount_price?: string | number | null;
  thumbnail?: string | null;
  short_description?: string;
  description?: string;
  learning_outcomes?: string[];
  primary_instructor?: { name?: string } | null;
  status?: string;
  is_published?: boolean;
  updated_at?: string | null;
};
export type ApiBatchRow = {
  id: string;
  code: string;
  course?: string;
  course_title?: string;
  teacher?: string | null;
  teacher_name?: string | null;
  shift?: string | null;
  shift_detail?: { name?: string; code?: string; start_time?: string; end_time?: string; working_days?: string[] } | null;
  capacity?: number;
  enrolled_count?: number;
  start_date?: string | null;
  status?: string;
};
export type ApiShiftRow = {
  id: string;
  name: string;
  code: string;
  start_time?: string;
  end_time?: string;
  working_days?: string[];
};
export type ApiEnrollmentRow = {
  id: string;
  student?: string;
  student_display?: string;
  course?: string;
  course_title?: string;
  batch?: string | null;
  batch_code?: string | null;
  shift?: string | null;
  status?: string;
  final_amount?: string | number;
  enrolled_at?: string;
};
export type ApiStudentFeeRow = {
  id: string;
  student?: string;
  enrollment?: string;
  course?: string;
  course_name?: string;
  batch_code?: string;
  student_id_display?: string;
  total_amount?: string | number;
  paid_amount?: string | number;
  due_amount?: string | number;
  discount_amount?: string | number;
  scholarship_amount?: string | number;
  status?: string;
  due_date?: string | null;
  notes?: string;
};

export type ApiPaymentRow = {
  id: string;
  student_fee: string;
  payment_number?: string;
  amount: string | number;
  payment_method?: string;
  transaction_id?: string;
  paid_at?: string;
  status?: string;
  receipt_number?: string | null;
  course_name?: string;
  notes?: string;
};
export type ApiCourseProgressRow = {
  id: string;
  student?: string;
  course?: string;
  progress_percent?: number;
  status?: string;
};
export type ApiChapterRow = {
  id: string;
  course?: string;
  title: string;
  order?: number;
  parts?: {
    id: string;
    title: string;
    content_type?: string;
    video_url?: string;
    notes?: string;
    description?: string;
    video_duration_seconds?: number | null;
    estimated_minutes?: number | null;
  }[];
};
export type ApiPartResourceRow = {
  id: string;
  part: string;
  title: string;
  resource_type: string;
  file: string | null;
  external_url?: string;
  created_at: string;
  updated_at?: string;
  timestamps?: unknown;
};
export type ApiAssignmentRow = {
  id: string;
  title: string;
  course?: string;
  batch?: string | null;
  teacher?: string;
  due_date?: string;
  status?: string;
  allocations?: unknown[];
};
export type ApiSubmissionRow = {
  id: string;
  assignment?: string;
  student?: string;
  status?: string;
};
export type ApiCertificateRow = {
  id: string;
  certificate_number?: string;
  verification_code?: string;
  student_name?: string;
  course_title?: string;
  issue_date?: string;
  status?: string;
  instructor_name?: string;
  metadata?: Record<string, unknown> | null;
};
export type ApiBoardTaskRow = {
  id: string;
  title: string;
  course?: string | null;
  course_title?: string;
  due?: string;
  status?: string;
  status_label?: string;
  student?: string;
  student_name?: string;
  student_id_display?: string;
  created_by_role?: string;
  assigned_by?: string;
  created_by?: number | null;
};
export type ApiSeoRow = {
  id: string;
  slug?: string;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  calculated_score?: number;
  seo_score?: number;
  canonical_url?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string | null;
  twitter_card?: string;
  robots?: string;
};

export type RevenueSummary = {
  months?: number;
  grand_total?: string;
  this_month?: string;
  today?: string;
  this_week?: string;
  this_year?: string;
  outstanding?: string;
  by_course?: { course_name: string; total: string }[];
  by_batch?: { batch_code: string; total: string }[];
  series?: { year: number; month: number; label: string; total: string; payment_count?: number }[];
};

export type EnrollmentTrends = {
  months?: number;
  series?: { year: number; month: number; label: string; count: number }[];
};

export type DashboardBundle = {
  students: ApiStudentRow[];
  teachers: ApiTeacherRow[];
  courses: ApiCourseRow[];
  batches: ApiBatchRow[];
  shifts: ApiShiftRow[];
  enrollments: ApiEnrollmentRow[];
  studentFees: ApiStudentFeeRow[];
  courseProgress: ApiCourseProgressRow[];
  chapters: ApiChapterRow[];
  partResources: ApiPartResourceRow[];
  assignments: ApiAssignmentRow[];
  submissions: ApiSubmissionRow[];
  certificates: ApiCertificateRow[];
  tasks: ApiBoardTaskRow[];
  seoPages: ApiSeoRow[];
  cmsBlog: Awaited<ReturnType<typeof cmsApi.listBlogPosts>>;
  cmsEvents: Awaited<ReturnType<typeof cmsApi.listEvents>>;
  cmsFaqs: Awaited<ReturnType<typeof cmsApi.listFaqs>>;
  cmsTestimonials: Awaited<ReturnType<typeof cmsApi.listTestimonials>>;
  courseCategories: ApiCategoryRow[];
};

export async function fetchDashboardBundle(): Promise<DashboardBundle | null> {
  if (!getAccessToken()) return null;

  try {
    const [
      students,
      teachers,
      courses,
      courseCategories,
      batches,
      shifts,
      enrollments,
      studentFees,
      courseProgress,
      chapters,
      partResources,
      assignments,
      submissions,
      certificates,
      tasks,
      seoPages,
      cmsBlog,
      cmsEvents,
      cmsFaqs,
      cmsTestimonials,
    ] = await Promise.all([
      apiList<ApiStudentRow>("/students/profiles/"),
      apiList<ApiTeacherRow>("/teachers/profiles/"),
      apiList<ApiCourseRow>(courseEndpoints.list()),
      apiList<ApiCategoryRow>(courseEndpoints.categories()),
      apiList<ApiBatchRow>(batchEndpoints.list()),
      apiList<ApiShiftRow>("/batches/shifts/"),
      apiList<ApiEnrollmentRow>("/enrollments/enrollments/"),
      apiList<ApiStudentFeeRow>("/fees/student-fees/"),
      apiList<ApiCourseProgressRow>("/content/course-progress/"),
      apiList<ApiChapterRow>("/content/chapters/"),
      apiList<ApiPartResourceRow>("/content/resources/"),
      apiList<ApiAssignmentRow>("/assignments/assignments/"),
      apiList<ApiSubmissionRow>("/assignments/submissions/"),
      apiList<ApiCertificateRow>("/certificates/"),
      apiList<ApiBoardTaskRow>("/tasks/board/"),
      apiList<ApiSeoRow>("/seo/metadata/"),
      cmsApi.listBlogPosts(),
      cmsApi.listEvents(),
      cmsApi.listFaqs(),
      cmsApi.listTestimonials(),
    ]);

    return {
      students,
      teachers,
      courses,
      courseCategories,
      batches,
      shifts,
      enrollments,
      studentFees,
      courseProgress,
      chapters,
      partResources,
      assignments,
      submissions,
      certificates,
      tasks,
      seoPages,
      cmsBlog,
      cmsEvents,
      cmsFaqs,
      cmsTestimonials,
    };
  } catch (err) {
    console.error("[dashboard-api] bundle fetch failed", err);
    return null;
  }
}

export async function fetchRevenueSummary(months = 6): Promise<RevenueSummary | null> {
  return apiGet<RevenueSummary>(`/analytics/revenue/summary/?months=${months}`);
}

export async function fetchEnrollmentTrends(months = 6): Promise<EnrollmentTrends | null> {
  return apiGet<EnrollmentTrends>(`/analytics/enrollments/trends/?months=${months}`);
}

export type ApiInvoiceRow = {
  id: string;
  student_fee: string;
  student_name?: string;
  student_id_display?: string;
  course_name?: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: string;
  tax_amount?: string;
  total_amount: string;
  status: string;
  notes?: string;
  created_at?: string;
};

export async function fetchInvoices(): Promise<ApiInvoiceRow[]> {
  return apiList<ApiInvoiceRow>("/fees/invoices/");
}

export async function fetchStudentFees(): Promise<ApiStudentFeeRow[]> {
  return apiList<ApiStudentFeeRow>("/fees/student-fees/");
}

export async function fetchPayments(): Promise<ApiPaymentRow[]> {
  return apiList<ApiPaymentRow>("/fees/payments/");
}

export async function createInvoice(payload: {
  student_fee: string;
  amount: number;
  due_date?: string;
  issue_date?: string;
  notes?: string;
}): Promise<ApiInvoiceRow | null> {
  return apiMutate<ApiInvoiceRow>("/fees/invoices/", "POST", {
    ...payload,
    status: "ISSUED",
    tax_amount: 0,
    total_amount: payload.amount,
  });
}

export async function recordStudentFeePayment(
  studentFeeId: string,
  payload: {
    amount: number;
    payment_method: string;
    paid_at?: string;
    transaction_id?: string;
    notes?: string;
    create_receipt?: boolean;
  },
): Promise<ApiPaymentRow | null> {
  return apiMutate<ApiPaymentRow>(
    `/fees/student-fees/${studentFeeId}/record-payment/`,
    "POST",
    {
      create_receipt: true,
      ...payload,
    },
  );
}

export async function bulkAssignTasks(payload: {
  title: string;
  course: string;
  due: string;
  batch_ids?: string[];
  student_ids?: string[];
  assigned_by?: string;
}): Promise<{ count: number } | null> {
  return apiMutate<{ count: number }>("/tasks/board/bulk-assign/", "POST", payload);
}

export const dashboardKeys = {
  bundle: ["dashboard", "bundle"] as const,
  revenue: (months: number) => ["dashboard", "revenue", months] as const,
  enrollments: (months: number) => ["dashboard", "enrollments", months] as const,
};

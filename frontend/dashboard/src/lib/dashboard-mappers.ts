/**
 * Map backend dashboard API payloads → frontend mock-shaped types.
 */

import type {
  ApiAssignmentRow,
  ApiBatchRow,
  ApiBoardTaskRow,
  ApiCertificateRow,
  ApiChapterRow,
  ApiCourseProgressRow,
  ApiCourseRow,
  ApiEnrollmentRow,
  ApiSeoRow,
  ApiShiftRow,
  ApiStudentFeeRow,
  ApiStudentRow,
  ApiSubmissionRow,
  ApiTeacherRow,
  DashboardBundle,
  EnrollmentTrends,
  RevenueSummary,
} from "./dashboard-api";
import type { BoardTask, TaskStatus } from "./mock";
import { resolveCourseThumbnail } from "./course-media";

type MappedStudent = {
  id: string;
  name: string;
  email: string;
  phone: string;
  course: string;
  batch: string;
  shift: "Morning" | "Daytime" | "Evening" | "Weekend";
  status: "Active" | "On Hold" | "Completed" | "Deactivated";
  progress: number;
  progressNote?: string;
  fees: { total: number; paid: number; due: number };
  joined: string;
  avatar: string;
  /** Last issued temporary password (admin-only until user changes it) */
  provisionalPassword?: string;
  mustChangePassword?: boolean;
  /** Backend UUID for PATCH */
  _uuid?: string;
  /** Student fee record UUID for invoices */
  _studentFeeId?: string;
};

type MappedTeacher = {
  name: string;
  role: string;
  exp: string;
  courses: number;
  avatar: string;
  bio: string;
  _uuid?: string;
};

type MappedCourse = {
  slug: string;
  title: string;
  category: string;
  categories: string[];
  level: "Beginner" | "Intermediate" | "Advanced";
  mode: "Physical" | "Online" | "Hybrid";
  duration: string;
  price: number;
  rating: number | null;
  students: number;
  instructor: string;
  cover: string;
  tagline: string;
  description: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  outcomes: string[];
  isPublished?: boolean;
  _uuid?: string;
  chapters: {
    id?: string;
    title: string;
    parts: {
      id?: string;
      title: string;
      type: "video" | "pdf" | "notes";
      duration?: string;
      videoUrl?: string;
      notes?: string;
      description?: string;
    }[];
  }[];
};

type MappedBatch = {
  id: string;
  course: string;
  teacher: string;
  shift: string;
  capacity: number;
  enrolled: number;
  start: string;
  status: "Ongoing" | "Upcoming" | "Completed";
  _uuid?: string;
};

type MappedShift = {
  id: string;
  course: string;
  batch: string;
  teacher: string;
  startTime: string;
  endTime: string;
  days: string;
};

type MappedAssignment = {
  title: string;
  course: string;
  batch: string;
  due: string;
  dueAt: string;
  submissions: number;
  total: number;
  status: "Active" | "Grading" | "Completed";
  teacher: string;
  portalOpen: boolean;
  _uuid?: string;
};

type MappedCertificate = {
  code: string;
  student: string;
  course: string;
  issued: string;
  status: "Valid" | "Revoked";
  supervisorName?: string;
  startDate?: string;
  endDate?: string;
  skills?: string;
};

type MappedSeoPage = {
  path: string;
  title: string;
  score: number;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  robots?: string;
  id?: string;
};

export type MappedDashboardData = {
  students: MappedStudent[];
  teachers: MappedTeacher[];
  courses: MappedCourse[];
  batches: MappedBatch[];
  shifts: MappedShift[];
  assignments: MappedAssignment[];
  certificates: MappedCertificate[];
  tasks: BoardTask[];
  seoPages: MappedSeoPage[];
  submissions: {
    id: string;
    assignmentTitle: string;
    studentId: string;
    studentName: string;
    notes: string;
    fileName: string;
    submittedAt: string;
    score?: number;
    feedback?: string;
    status: "submitted" | "reviewed";
  }[];
  blog: { slug: string; title: string; excerpt: string; author: string; date: string; cover: string }[];
  events: { title: string; date: string; time: string; location: string; tag: string }[];
  faqs: { q: string; a: string }[];
  testimonials: { name: string; role: string; quote: string; avatar: string }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonthLabel(label: string): string {
  const parts = label.split("-");
  if (parts.length >= 2) {
    const m = parseInt(parts[1], 10);
    if (m >= 1 && m <= 12) return MONTHS[m - 1];
  }
  return label;
}

function formatDate(d?: string | null): string {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

function formatDue(d?: string): { due: string; dueAt: string } {
  if (!d) return { due: "—", dueAt: "" };
  try {
    const dt = new Date(d);
    return {
      due: dt.toLocaleString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      dueAt: dt.toISOString(),
    };
  } catch {
    return { due: d, dueAt: d };
  }
}

function formatTime(t?: string): string {
  if (!t) return "—";
  const [h, m] = t.split(":");
  if (!h) return t;
  const hour = parseInt(h, 10);
  const min = m?.slice(0, 2) || "00";
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${min} ${ampm}`;
}

function mapStudentStatus(s?: string): MappedStudent["status"] {
  switch ((s || "").toUpperCase()) {
    case "ACTIVE":
      return "Active";
    case "INACTIVE":
    case "DROPPED":
    case "SUSPENDED":
      return "Deactivated";
    case "GRADUATED":
    case "COMPLETED":
      return "Completed";
    default:
      return "Active";
  }
}

function mapBatchStatus(s?: string): MappedBatch["status"] {
  switch ((s || "").toUpperCase()) {
    case "ONGOING":
      return "Ongoing";
    case "COMPLETED":
      return "Completed";
    default:
      return "Upcoming";
  }
}

function mapCourseLevel(l?: string): MappedCourse["level"] {
  const u = (l || "").toUpperCase();
  if (u.includes("ADVANCED")) return "Advanced";
  if (u.includes("INTERMEDIATE")) return "Intermediate";
  return "Beginner";
}

function mapCourseMode(t?: string): MappedCourse["mode"] {
  switch ((t || "").toUpperCase()) {
    case "PHYSICAL":
      return "Physical";
    case "HYBRID":
      return "Hybrid";
    default:
      return "Online";
  }
}

function mapShiftName(name?: string | null): MappedStudent["shift"] {
  const n = (name || "").toLowerCase();
  if (n.includes("morning")) return "Morning";
  if (n.includes("day")) return "Daytime";
  if (n.includes("weekend")) return "Weekend";
  return "Evening";
}

function mapPartType(ct?: string): "video" | "pdf" | "notes" {
  const u = (ct || "").toUpperCase();
  if (u.includes("PDF")) return "pdf";
  if (u.includes("NOTE")) return "notes";
  return "video";
}

function formatDuration(seconds?: number | null, minutes?: number | null): string | undefined {
  if (seconds && seconds > 0) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  if (minutes && minutes > 0) return `${minutes}:00`;
  return undefined;
}

function mapTaskStatus(s?: string, label?: string): TaskStatus {
  const raw = (label || s || "").toUpperCase();
  if (raw.includes("COMPLETED")) return "Completed";
  if (raw.includes("SUBMITTED")) return "Submitted";
  if (raw.includes("PROGRESS")) return "In Progress";
  return "To Do";
}

function mapAssignmentStatus(s?: string): MappedAssignment["status"] {
  switch ((s || "").toUpperCase()) {
    case "CLOSED":
      return "Completed";
    case "DRAFT":
      return "Grading";
    default:
      return "Active";
  }
}

function mapCertStatus(s?: string): MappedCertificate["status"] {
  const u = (s || "").toUpperCase();
  return u === "REVOKED" || u === "CANCELLED" ? "Revoked" : "Valid";
}

function buildLookups(bundle: DashboardBundle) {
  const batchById = new Map<string, ApiBatchRow>();
  const batchByCode = new Map<string, ApiBatchRow>();
  for (const b of bundle.batches) {
    batchById.set(String(b.id), b);
    if (b.code) batchByCode.set(b.code, b);
  }

  const courseById = new Map<string, ApiCourseRow>();
  const courseTitleById = new Map<string, string>();
  for (const c of bundle.courses) {
    courseById.set(String(c.id), c);
    courseTitleById.set(String(c.id), c.title);
  }

  const teacherNameById = new Map<string, string>();
  for (const t of bundle.teachers) {
    const name = t.full_name || [t.user?.first_name, t.user?.last_name].filter(Boolean).join(" ") || "Instructor";
    teacherNameById.set(String(t.id), name);
  }

  const enrollmentByStudent = new Map<string, ApiEnrollmentRow>();
  const activeStatuses = new Set(["PENDING", "APPROVED", "ACTIVE", "SUSPENDED"]);
  for (const e of bundle.enrollments) {
    if (!e.student) continue;
    const sid = String(e.student);
    const status = String(e.status || "").toUpperCase();
    const existing = enrollmentByStudent.get(sid);
    if (!existing) {
      enrollmentByStudent.set(sid, e);
      continue;
    }
    const existingActive = activeStatuses.has(String(existing.status || "").toUpperCase());
    const nextActive = activeStatuses.has(status);
    // Prefer active enrollments; otherwise keep the latest row seen.
    if (nextActive && !existingActive) enrollmentByStudent.set(sid, e);
  }

  // Student fees are tied to a specific enrollment, not just the student.
  // If the API payload ever lacks `enrollment`, we fall back to student mapping.
  const feesByEnrollment = new Map<string, ApiStudentFeeRow>();
  const feesByStudent = new Map<string, ApiStudentFeeRow>();
  for (const f of bundle.studentFees) {
    if (f.enrollment) feesByEnrollment.set(String(f.enrollment), f);
    else if (f.student) feesByStudent.set(String(f.student), f);
  }

  const progressByStudent = new Map<string, ApiCourseProgressRow>();
  for (const p of bundle.courseProgress) {
    if (p.student) progressByStudent.set(String(p.student), p);
  }

  const submissionsByAssignment = new Map<string, number>();
  const assignmentIdToTitle = new Map<string, string>();
  for (const a of bundle.assignments) {
    assignmentIdToTitle.set(String(a.id), a.title);
  }
  for (const s of bundle.submissions) {
    if (s.assignment) {
      const key = String(s.assignment);
      submissionsByAssignment.set(key, (submissionsByAssignment.get(key) || 0) + 1);
    }
  }

  const studentUuidToCode = new Map<string, string>();
  for (const s of bundle.students) {
    studentUuidToCode.set(String(s.id), s.student_id);
  }

  const chaptersByCourse = new Map<string, ApiChapterRow[]>();
  for (const ch of bundle.chapters) {
    if (!ch.course) continue;
    const key = String(ch.course);
    const list = chaptersByCourse.get(key) || [];
    list.push(ch);
    chaptersByCourse.set(key, list);
  }

  const teacherCourses = new Map<string, number>();
  for (const b of bundle.batches) {
    if (b.teacher) {
      const key = String(b.teacher);
      teacherCourses.set(key, (teacherCourses.get(key) || 0) + 1);
    }
  }

  return {
    batchById,
    batchByCode,
    courseById,
    courseTitleById,
    teacherNameById,
    enrollmentByStudent,
    feesByEnrollment,
    feesByStudent,
    progressByStudent,
    submissionsByAssignment,
    assignmentIdToTitle,
    studentUuidToCode,
    chaptersByCourse,
    teacherCourses,
  };
}

export function mapDashboardBundle(bundle: DashboardBundle): MappedDashboardData {
  const L = buildLookups(bundle);

  const students: MappedStudent[] = bundle.students.map((s) => {
    const sid = String(s.id);
    const enrollment = L.enrollmentByStudent.get(sid);
    const feesFromEnrollment = enrollment?.id ? L.feesByEnrollment.get(String(enrollment.id)) : undefined;
    const feesFallback = L.feesByStudent.get(sid);
    const courseId = enrollment?.course ? String(enrollment.course) : "";
    const courseRow = courseId ? L.courseById.get(courseId) : undefined;
    // Only trust a StudentFee row when it matches the active enrollment course.
    const fees =
      (feesFromEnrollment &&
      (!feesFromEnrollment.course || !courseId || String(feesFromEnrollment.course) === courseId)
        ? feesFromEnrollment
        : undefined) ??
      (feesFallback &&
      (!feesFallback.course || !courseId || String(feesFallback.course) === courseId)
        ? feesFallback
        : undefined);
    const progress = L.progressByStudent.get(sid);
    const batch = enrollment?.batch ? L.batchById.get(String(enrollment.batch)) : undefined;
    const courseTitle =
      enrollment?.course_title ||
      (courseId ? L.courseTitleById.get(courseId) : undefined) ||
      "—";
    const batchCode = batch?.code || enrollment?.batch_code || "—";
    const shiftName = batch?.shift_detail?.name || batch?.shift || "";
    const name =
      s.full_name ||
      [s.user?.first_name, s.user?.last_name].filter(Boolean).join(" ").trim() ||
      s.student_id;
    const studentCode = s.student_id || sid;
    const coursePrice = Number(courseRow?.discount_price ?? courseRow?.price ?? 0);
    const total = Number(
      fees?.total_amount ??
        enrollment?.final_amount ??
        coursePrice ??
        0,
    );
    const paid = Number(fees?.paid_amount ?? 0);
    const due = Number(fees?.due_amount ?? Math.max(0, total - paid));

    return {
      id: studentCode,
      name,
      email: s.user?.email || "",
      phone: s.user?.phone || "",
      course: courseTitle || "—",
      batch: batchCode || "—",
      shift: mapShiftName(shiftName),
      status: mapStudentStatus(s.status),
      progress: progress?.progress_percent ?? 0,
      fees: { total, paid, due },
      joined: formatDate(s.admission_date),
      avatar: s.user?.avatar ? String(s.user.avatar) : "",
      provisionalPassword: s.user?.provisional_password || "",
      mustChangePassword: Boolean(s.user?.must_change_password),
      _uuid: sid,
      _studentFeeId: fees ? String(fees.id) : undefined,
    };
  });

  const teachers: MappedTeacher[] = bundle.teachers.map((t) => {
    const name =
      t.full_name ||
      [t.user?.first_name, t.user?.last_name].filter(Boolean).join(" ").trim() ||
      "Instructor";
    const expYears = t.years_of_experience;
    return {
      name,
      role: t.designation || "Instructor",
      exp: expYears != null ? `${expYears} yrs` : "—",
      courses: L.teacherCourses.get(String(t.id)) || 0,
      avatar: t.user?.avatar ? String(t.user.avatar) : "",
      bio: t.bio || "",
      _uuid: String(t.id),
    };
  });

  const seoByCoursePath = new Map<string, ApiSeoRow>();
  for (const p of bundle.seoPages) {
    const path = p.canonical_url || (p.slug ? `/${p.slug}` : "");
    if (path.startsWith("/courses/")) seoByCoursePath.set(path, p);
    else if (p.slug) seoByCoursePath.set(`/courses/${p.slug}`, p);
  }

  const courses: MappedCourse[] = bundle.courses.map((c) => {
    const chaptersRaw = (L.chaptersByCourse.get(String(c.id)) || []).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    const chapters = chaptersRaw.map((ch) => ({
      id: String(ch.id),
      title: ch.title,
      parts: (ch.parts || [])
        .sort((a, b) => ((a as { order?: number }).order ?? 0) - ((b as { order?: number }).order ?? 0))
        .map((p) => ({
          id: String(p.id),
          title: p.title,
          type: mapPartType(p.content_type),
          duration: formatDuration(p.video_duration_seconds, p.estimated_minutes),
          videoUrl: p.video_url || "",
          notes: p.notes || "",
          description: p.description || "",
        })),
    }));

    const weeks = c.duration_weeks;
    const hours = c.duration_hours;
    let duration = "—";
    if (weeks) duration = `${weeks} weeks`;
    else if (hours) duration = `${hours} hours`;

    const enrolledInCourse = bundle.batches
      .filter((b) => String(b.course) === String(c.id) || b.course_title === c.title)
      .reduce((n, b) => n + (b.enrolled_count || 0), 0);

    const seo = seoByCoursePath.get(`/courses/${c.slug}`);

    const categoryNames =
      Array.isArray(c.category_names) && c.category_names.length
        ? c.category_names.map(String)
        : c.category_name
          ? [String(c.category_name)]
          : [];

    return {
      slug: c.slug,
      title: c.title,
      category: categoryNames[0] || "General",
      categories: categoryNames,
      level: mapCourseLevel(c.level),
      mode: mapCourseMode(c.enrollment_type),
      duration,
      price: Number(c.discount_price ?? c.price ?? 0),
      rating: null,
      students: enrolledInCourse,
      instructor: c.primary_instructor?.name || "—",
      cover: resolveCourseThumbnail(c.thumbnail, c.updated_at),
      tagline: c.short_description || "",
      description: c.description || c.short_description || "",
      metaTitle: seo?.meta_title || undefined,
      metaDescription: seo?.meta_description || undefined,
      metaKeywords: seo?.meta_keywords || undefined,
      outcomes: Array.isArray(c.learning_outcomes) ? c.learning_outcomes : [],
      isPublished:
        Boolean(c.is_published) &&
        (!c.status || String(c.status).toUpperCase() === "PUBLISHED"),
      chapters,
      _uuid: String(c.id),
    };
  });

  const batches: MappedBatch[] = bundle.batches.map((b) => ({
    id: b.code || String(b.id),
    course: b.course_title || "—",
    teacher:
      b.teacher_name ||
      (b.teacher ? L.teacherNameById.get(String(b.teacher)) : undefined) ||
      "—",
    shift: b.shift_detail?.name || mapShiftName(typeof b.shift === "string" ? b.shift : undefined),
    capacity: b.capacity ?? 30,
    enrolled: b.enrolled_count ?? 0,
    start: formatDate(b.start_date),
    status: mapBatchStatus(b.status),
    _uuid: String(b.id),
  }));

  const shifts: MappedShift[] = (() => {
    if (bundle.shifts.length) {
      return bundle.shifts.map((s) => {
        const linked = bundle.batches.find((b) => String(b.shift) === String(s.id));
        const days = Array.isArray(s.working_days) ? s.working_days.join("–") : "Mon–Sat";
        return {
          id: s.code || String(s.id),
          course: linked?.course_title || "—",
          batch: linked?.code || "—",
          teacher:
            linked?.teacher_name ||
            (linked?.teacher ? L.teacherNameById.get(String(linked.teacher)) : undefined) ||
            "—",
          startTime: formatTime(s.start_time),
          endTime: formatTime(s.end_time),
          days,
        };
      });
    }
    return bundle.batches
      .filter((b) => b.shift_detail)
      .map((b) => {
        const sd = b.shift_detail!;
        const days = Array.isArray(sd.working_days) ? sd.working_days.join("–") : "Mon–Sat";
        return {
          id: sd.code || String(b.shift),
          course: b.course_title || "—",
          batch: b.code || "—",
          teacher:
            b.teacher_name ||
            (b.teacher ? L.teacherNameById.get(String(b.teacher)) : undefined) ||
            "—",
          startTime: formatTime(sd.start_time),
          endTime: formatTime(sd.end_time),
          days,
        };
      });
  })();

  const assignments: MappedAssignment[] = bundle.assignments.map((a) => {
    const batch = a.batch ? L.batchById.get(String(a.batch)) : undefined;
    const courseTitle =
      (a.course ? L.courseTitleById.get(String(a.course)) : undefined) || "—";
    const batchCode = batch?.code || "—";
    const teacherName = a.teacher ? L.teacherNameById.get(String(a.teacher)) || "—" : "—";
    const { due, dueAt } = formatDue(a.due_date);
    const total = batch?.enrolled_count ?? 0;
    const subs = L.submissionsByAssignment.get(String(a.id)) || 0;
    const isOpen =
      (a.status || "").toUpperCase() === "PUBLISHED" &&
      (!a.due_date || new Date(a.due_date).getTime() > Date.now());

    return {
      title: a.title,
      course: courseTitle,
      batch: batchCode,
      due,
      dueAt,
      submissions: subs,
      total: total || Math.max(subs, 1),
      status: mapAssignmentStatus(a.status),
      teacher: teacherName,
      portalOpen: isOpen,
      _uuid: String(a.id),
    };
  });

  const certificates: MappedCertificate[] = bundle.certificates.map((c) => {
    const meta = (c.metadata || {}) as Record<string, unknown>;
    return {
      code: c.certificate_number || c.verification_code || String(c.id),
      student: c.student_name || "—",
      course: c.course_title || "—",
      issued: formatDate(c.issue_date),
      status: mapCertStatus(c.status),
      supervisorName:
        c.instructor_name ||
        (typeof meta.instructor_name === "string" ? meta.instructor_name : undefined) ||
        (typeof meta.supervisor_name === "string" ? meta.supervisor_name : undefined),
      startDate: typeof meta.start_date === "string" ? meta.start_date : undefined,
      endDate: typeof meta.end_date === "string" ? meta.end_date : undefined,
      skills: typeof meta.skills === "string" ? meta.skills : undefined,
    };
  });

  const tasks: BoardTask[] = bundle.tasks.map((t) => ({
    id: String(t.id),
    title: t.title,
    course: t.course_title || "—",
    due: t.due || "—",
    status: mapTaskStatus(t.status, t.status_label),
    studentId: t.student_id_display || String(t.student || ""),
    studentName: t.student_name || "—",
    createdByRole: (t.created_by_role?.toLowerCase() || "admin") as BoardTask["createdByRole"],
    createdByName: t.assigned_by || "Admin",
    assignedBy: t.assigned_by || undefined,
  }));

  const seoPages: MappedSeoPage[] = bundle.seoPages.length
    ? bundle.seoPages.map((p) => ({
        id: String(p.id),
        path: p.canonical_url || (p.slug ? `/${p.slug}` : "/"),
        title: p.meta_title || p.slug || "Page",
        score: p.calculated_score ?? p.seo_score ?? 80,
        description: p.meta_description || undefined,
        keywords: p.meta_keywords || undefined,
        canonical: p.canonical_url || undefined,
        ogImage: p.og_image || undefined,
        robots: p.robots || undefined,
      }))
    : [];

  const submissions = bundle.submissions.map((s) => {
    const assignmentTitle = s.assignment ? L.assignmentIdToTitle.get(String(s.assignment)) || "Assignment" : "Assignment";
    const studentCode = s.student ? L.studentUuidToCode.get(String(s.student)) || String(s.student) : "";
    const reviewed = (s as ApiSubmissionRow & { review?: { marks_obtained?: number; feedback?: string } }).review;
    return {
      id: String(s.id),
      assignmentTitle,
      studentId: studentCode,
      studentName: studentCode,
      notes: (s as ApiSubmissionRow & { content?: string }).content || "",
      fileName: "",
      submittedAt: (s as ApiSubmissionRow & { submitted_at?: string }).submitted_at || new Date().toISOString(),
      score: reviewed?.marks_obtained != null ? Number(reviewed.marks_obtained) : undefined,
      feedback: reviewed?.feedback,
      status: reviewed ? ("reviewed" as const) : ("submitted" as const),
    };
  });

  const blog = bundle.cmsBlog.map((b) => ({
    slug: b.slug,
    title: b.title,
    excerpt: b.excerpt,
    author: "Admin",
    date: b.published_at
      ? new Date(b.published_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
      : "",
    cover: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200",
  }));

  const events = bundle.cmsEvents.map((e) => ({
    title: e.title,
    date: new Date(e.start_datetime).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
    time: new Date(e.start_datetime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    location: e.location,
    tag: "Event",
  }));

  const faqs = bundle.cmsFaqs.map((f) => ({ q: f.question, a: f.answer }));

  const testimonials = bundle.cmsTestimonials.map((t) => ({
    name: t.name,
    role: t.role || t.organization || "Graduate",
    quote: t.content,
    avatar: "",
  }));

  return {
    students,
    teachers,
    courses,
    batches,
    shifts,
    assignments,
    certificates,
    tasks,
    seoPages,
    submissions,
    blog,
    events,
    faqs,
    testimonials,
  };
}

export function mapRevenueChart(summary: RevenueSummary | null, fallback: { month: string; revenue: number }[]) {
  if (!summary?.series?.length) return fallback;
  return summary.series.slice(-6).map((row) => ({
    month: formatMonthLabel(row.label),
    revenue: Number(row.total) || 0,
  }));
}

export function mapEnrollmentChart(trends: EnrollmentTrends | null, fallback: { month: string; students: number }[]) {
  if (!trends?.series?.length) return fallback;
  return trends.series.slice(-6).map((row) => ({
    month: formatMonthLabel(row.label),
    students: row.count ?? 0,
  }));
}

export type { MappedStudent, MappedTeacher, MappedCourse, MappedBatch, MappedAssignment };
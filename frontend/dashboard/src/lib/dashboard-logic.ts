/**
 * Frontend dashboard KPI logic (mirrors backend analytics.dashboard_stats).
 * Used when the API is unavailable — same role rules as the UI.
 */

export type DashboardRole = "admin" | "teacher" | "student";

export type DashboardOverview = {
  role: DashboardRole;
  source: "api" | "frontend";
  generated_at: string;
  kpis: Record<string, number | string>;
  // Admin
  students?: number;
  teachers?: number;
  courses?: number;
  active_batches?: number;
  revenue_this_month?: string;
  // Teacher
  my_courses?: number;
  my_batches?: number;
  ongoing_batches?: number;
  my_students?: number;
  pending_reviews?: number;
  open_portals?: number;
  avg_progress?: number;
  active_learners?: number;
  batches?: { id: string; code?: string; course: string; start: string; status: string }[];
  assignments?: { title: string; due: string; submissions?: number; total?: number; status?: string; portal_open?: boolean }[];
  students_preview?: { id: string; name: string; batch: string; progress: number; status: string }[];
  // Student
  open_assignments?: number;
  active_tasks?: number;
  certificates?: number;
  progress?: number;
  fees?: { total: string; paid: string; due: string; status: string };
  course_title?: string;
  batch?: string;
  tasks?: { id: string; title: string; due: string; status: string }[];
};

type TeacherInput = {
  courses: { title: string }[];
  batches: { id: string; course: string; start: string; status: string }[];
  students: { id: string; name: string; batch: string; progress: number; status: string; avatar?: string }[];
  assignments: { title: string; due: string; submissions: number; total: number; status: string; portalOpen?: boolean }[];
};

type StudentInput = {
  me?: {
    id: string;
    name: string;
    course: string;
    batch: string;
    progress: number;
    fees: { total: number; paid: number; due: number };
  } | null;
  courses: unknown[];
  assignments: { title: string; due: string; portalOpen?: boolean }[];
  tasks: { id: string; title: string; due: string; status: string }[];
  certificates: unknown[];
  openAssignments: unknown[];
};

type AdminInput = {
  students: { fees: { paid: number } }[];
  batches: { status: string }[];
  courses: unknown[];
};

export function buildAdminOverview(data: AdminInput): DashboardOverview {
  const ongoing = data.batches.filter((b) => b.status === "Ongoing").length;
  const revenue = data.students.reduce((n, s) => n + (s.fees?.paid || 0), 0);
  return {
    role: "admin",
    source: "frontend",
    generated_at: new Date().toISOString(),
    students: data.students.length,
    teachers: 0,
    courses: data.courses.length,
    active_batches: ongoing,
    revenue_this_month: String(revenue),
    kpis: {
      total_students: data.students.length,
      active_batches: ongoing,
      courses: data.courses.length,
      revenue,
    },
  };
}

export function buildTeacherOverview(data: TeacherInput): DashboardOverview {
  const ongoing = data.batches.filter((b) => b.status === "Ongoing").length;
  const pending = data.assignments.filter((a) => a.status === "Grading" || a.status === "Active").length;
  const avg = data.students.length
    ? Math.round(data.students.reduce((n, s) => n + s.progress, 0) / data.students.length)
    : 0;
  return {
    role: "teacher",
    source: "frontend",
    generated_at: new Date().toISOString(),
    my_courses: data.courses.length,
    my_batches: data.batches.length,
    ongoing_batches: ongoing,
    my_students: data.students.length,
    pending_reviews: pending,
    open_portals: data.assignments.filter((a) => a.portalOpen).length,
    avg_progress: avg,
    active_learners: data.students.filter((s) => s.status === "Active").length,
    kpis: {
      my_courses: data.courses.length,
      my_batches: data.batches.length,
      my_students: data.students.length,
      pending_reviews: pending,
    },
    batches: data.batches.map((b) => ({
      id: b.id,
      code: b.id,
      course: b.course,
      start: b.start,
      status: b.status,
    })),
    assignments: data.assignments.slice(0, 5).map((a) => ({
      title: a.title,
      due: a.due,
      submissions: a.submissions,
      total: a.total,
      status: a.status,
      portal_open: !!a.portalOpen,
    })),
    students_preview: data.students.slice(0, 6).map((s) => ({
      id: s.id,
      name: s.name,
      batch: s.batch,
      progress: s.progress,
      status: s.status,
    })),
  };
}

export function buildStudentOverview(data: StudentInput): DashboardOverview {
  const me = data.me;
  const due = me?.fees.due ?? 0;
  const paid = me?.fees.paid ?? 0;
  const total = me?.fees.total ?? 0;
  let feeStatus = "Paid";
  if (due > 0 && paid <= 0) feeStatus = "Pending";
  else if (due > 0 && paid > 0) feeStatus = "Partially overdue";

  const activeTasks = data.tasks.filter(
    (t) => t.status === "To Do" || t.status === "In Progress",
  ).length;

  return {
    role: "student",
    source: "frontend",
    generated_at: new Date().toISOString(),
    my_courses: data.courses.length,
    open_assignments: data.openAssignments.length,
    active_tasks: activeTasks,
    certificates: data.certificates.length,
    progress: me?.progress ?? 0,
    course_title: me?.course ?? "",
    batch: me?.batch ?? "",
    fees: {
      total: String(total),
      paid: String(paid),
      due: String(due),
      status: feeStatus,
    },
    kpis: {
      my_courses: data.courses.length,
      open_assignments: data.openAssignments.length,
      active_tasks: activeTasks,
      certificates: data.certificates.length,
    },
    assignments: data.assignments
      .filter((a) => a.portalOpen)
      .slice(0, 4)
      .map((a) => ({ title: a.title, due: a.due, portal_open: true })),
    tasks: data.tasks.slice(0, 5).map((t) => ({
      id: t.id,
      title: t.title,
      due: t.due,
      status: t.status,
    })),
  };
}

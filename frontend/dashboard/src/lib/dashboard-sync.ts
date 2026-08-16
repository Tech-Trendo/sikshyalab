/**
 * Transparent API sync for DashboardDataContext mutations.
 * Keeps existing local state logic; persists to backend when JWT is present.
 */

import { getAccessToken } from "./api";
import { batchEndpoints, courseEndpoints, coursePublicPath } from "./api-endpoints";
import {
  apiMutate,
  apiMutateDetailed,
  resolveOrCreateCategory,
  type DashboardBundle,
} from "./dashboard-api";

export type EntityMaps = {
  studentByCode: Map<string, string>;
  teacherByName: Map<string, string>;
  courseBySlug: Map<string, string>;
  courseByTitle: Map<string, string>;
  coursePriceByTitle: Map<string, number>;
  shiftByName: Map<string, string>;
  batchByCode: Map<string, string>;
  assignmentByTitle: Map<string, string>;
  seoByPath: Map<string, string>;
  studentFeeByStudent: Map<string, string>;
  studentFeeByEnrollment: Map<string, string>;
  /** student uuid → active enrollment uuid */
  enrollmentByStudent: Map<string, string>;
};

export function buildEntityMaps(bundle: DashboardBundle): EntityMaps {
  const studentByCode = new Map<string, string>();
  for (const s of bundle.students) {
    const uuid = String(s.id);
    studentByCode.set(uuid, uuid);
    if (s.student_id) studentByCode.set(s.student_id, uuid);
  }

  const teacherByName = new Map<string, string>();
  for (const t of bundle.teachers) {
    const name =
      t.full_name ||
      [t.user?.first_name, t.user?.last_name].filter(Boolean).join(" ").trim();
    if (name) teacherByName.set(name, String(t.id));
  }

  const courseBySlug = new Map<string, string>();
  const courseByTitle = new Map<string, string>();
  const coursePriceByTitle = new Map<string, number>();
  for (const c of bundle.courses) {
    courseBySlug.set(c.slug, String(c.id));
    courseByTitle.set(c.title, String(c.id));
    coursePriceByTitle.set(c.title, Number(c.discount_price ?? c.price ?? 0));
  }

  const shiftByName = new Map<string, string>();
  for (const s of bundle.shifts) {
    if (s.name) shiftByName.set(s.name.toLowerCase(), String(s.id));
    if (s.code) shiftByName.set(s.code.toLowerCase(), String(s.id));
  }

  const batchByCode = new Map<string, string>();
  for (const b of bundle.batches) {
    if (b.code) batchByCode.set(b.code, String(b.id));
  }

  const assignmentByTitle = new Map<string, string>();
  for (const a of bundle.assignments) {
    assignmentByTitle.set(a.title, String(a.id));
  }

  const seoByPath = new Map<string, string>();
  for (const p of bundle.seoPages) {
    const path = p.canonical_url || (p.slug ? `/${p.slug}` : "/");
    seoByPath.set(path, String(p.id));
  }

  const studentFeeByStudent = new Map<string, string>();
  for (const f of bundle.studentFees) {
    if (f.student) studentFeeByStudent.set(String(f.student), String(f.id));
  }

  const studentFeeByEnrollment = new Map<string, string>();
  for (const f of bundle.studentFees) {
    if (f.enrollment) studentFeeByEnrollment.set(String(f.enrollment), String(f.id));
  }

  const enrollmentByStudent = new Map<string, string>();
  const activeStatuses = new Set(["PENDING", "APPROVED", "ACTIVE", "SUSPENDED"]);
  for (const e of bundle.enrollments) {
    if (!e.student || !e.id) continue;
    const status = String(e.status || "").toUpperCase();
    if (!activeStatuses.has(status)) continue;
    const sid = String(e.student);
    if (!enrollmentByStudent.has(sid)) enrollmentByStudent.set(sid, String(e.id));
  }

  return {
    studentByCode,
    teacherByName,
    courseBySlug,
    courseByTitle,
    coursePriceByTitle,
    shiftByName,
    batchByCode,
    assignmentByTitle,
    seoByPath,
    studentFeeByStudent,
    studentFeeByEnrollment,
    enrollmentByStudent,
  };
}

const emptyMaps = (): EntityMaps => ({
  studentByCode: new Map(),
  teacherByName: new Map(),
  courseBySlug: new Map(),
  courseByTitle: new Map(),
  coursePriceByTitle: new Map(),
  shiftByName: new Map(),
  batchByCode: new Map(),
  assignmentByTitle: new Map(),
  seoByPath: new Map(),
  studentFeeByStudent: new Map(),
  studentFeeByEnrollment: new Map(),
  enrollmentByStudent: new Map(),
});

let entityMaps: EntityMaps = emptyMaps();

export function setEntityMaps(maps: EntityMaps) {
  entityMaps = maps;
}

function studentStatusToApi(status?: string): string | undefined {
  switch (status) {
    case "Active":
    case "Completed":
      return "ACTIVE";
    case "On Hold":
    case "Deactivated":
      return "INACTIVE";
    default:
      return undefined;
  }
}

function batchStatusToApi(status?: string): string | undefined {
  switch (status) {
    case "Ongoing":
      return "ONGOING";
    case "Completed":
      return "COMPLETED";
    default:
      return "UPCOMING";
  }
}

function parseBatchStartDate(value?: string): string | undefined {
  if (!value || value === "TBD") return undefined;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed).toISOString().slice(0, 10);
}

function assignmentStatusToApi(status?: string): string | undefined {
  switch (status) {
    case "Completed":
      return "CLOSED";
    case "Grading":
      return "PUBLISHED";
    default:
      return "PUBLISHED";
  }
}

function taskStatusToApi(status?: string): string | undefined {
  switch (status) {
    case "In Progress":
      return "IN_PROGRESS";
    case "Submitted":
      return "SUBMITTED";
    case "Completed":
      return "COMPLETED";
    default:
      return "TO_DO";
  }
}

export type SyncAction =
  | { type: "updateStudent"; id: string; patch: Record<string, unknown> }
  | { type: "deactivateStudent"; id: string }
  | { type: "reactivateStudent"; id: string }
  | { type: "deleteStudent"; id: string }
  | { type: "updateCourse"; slug: string; patch: Record<string, unknown> }
  | { type: "createCourse"; payload: Record<string, unknown> }
  | { type: "publishCourse"; slug: string }
  | { type: "unpublishCourse"; slug: string }
  | {
      type: "createBatch";
      payload: {
        code: string;
        name?: string;
        course: string;
        teacher?: string;
        shift?: string;
        capacity?: number;
        status?: string;
        startDate?: string;
      };
    }
  | { type: "updateBatch"; id: string; patch: Record<string, unknown> }
  | { type: "updateAssignment"; title: string; patch: Record<string, unknown> }
  | {
      type: "createAssignment";
      title: string;
      course: string;
      batch: string;
      dueAt: string;
      teacher?: string;
      portalOpen?: boolean;
      studentId?: string;
      maxMarks?: number;
    }
  | { type: "updateTask"; id: string; patch: Record<string, unknown> }
  | { type: "deleteTask"; id: string }
  | { type: "advanceTask"; id: string }
  | { type: "createInvoice"; studentFeeId: string; amount: number }
  | { type: "bulkAssignTasks"; title: string; course: string; due: string; batchIds?: string[]; studentIds?: string[]; assignedBy?: string }
  | {
      type: "createTask";
      title: string;
      course: string;
      due: string;
      studentId: string;
      assignedBy?: string;
      createdByRole?: string;
    }
  | { type: "updateSeo"; path: string; patch: Record<string, unknown> }
  | { type: "updateBlog"; slug: string; patch: Record<string, unknown> }
  | { type: "createBlog"; payload: Record<string, unknown> }
  | { type: "updateEvent"; slug: string; patch: Record<string, unknown> }
  | { type: "updateFaq"; id: string | number; patch: Record<string, unknown> }
  | { type: "reviewSubmission"; id: string; score: number; feedback: string };

export async function runDashboardSync(action: SyncAction): Promise<boolean | string> {
  if (!getAccessToken()) return false;
  const M = entityMaps;

  switch (action.type) {
    case "updateStudent": {
      const uuid = M.studentByCode.get(action.id);
      if (!uuid) return false;
      const body: Record<string, unknown> = {};
      if (action.patch.status) body.status = studentStatusToApi(String(action.patch.status));
      if (action.patch.name != null && String(action.patch.name).trim()) {
        body.name = String(action.patch.name).trim();
      }
      if (action.patch.phone != null) body.phone = String(action.patch.phone);
      if (action.patch.email != null && String(action.patch.email).trim()) {
        body.email = String(action.patch.email).trim();
      }
      let ok =
        Object.keys(body).length === 0
          ? true
          : !!(await apiMutate(`/students/profiles/${uuid}/`, "PATCH", body));

      const courseTitle = action.patch.course != null ? String(action.patch.course) : "";
      const batchCode = action.patch.batch != null ? String(action.patch.batch) : "";
      if (courseTitle || batchCode) {
        const courseId = courseTitle ? M.courseByTitle.get(courseTitle) : undefined;
        const batchId = batchCode ? M.batchByCode.get(batchCode) : undefined;
        const coursePrice = courseTitle ? M.coursePriceByTitle.get(courseTitle) : undefined;
        const enrollmentId = M.enrollmentByStudent.get(uuid);
        if (enrollmentId && (courseId || batchId)) {
          const enrollBody: Record<string, unknown> = {};
          if (courseId) {
            enrollBody.course = courseId;
            if (coursePrice != null && Number.isFinite(coursePrice)) {
              enrollBody.amount = coursePrice;
              enrollBody.discount_amount = 0;
            }
          }
          if (batchId) enrollBody.batch = batchId;
          ok =
            ok &&
            !!(await apiMutate(`/enrollments/enrollments/${enrollmentId}/`, "PATCH", enrollBody));

          // StudentFee is created/updated by the enrollment PATCH on the backend.
          // If a fee row already exists locally, nudge totals for immediate consistency.
          if (courseId && coursePrice != null && Number.isFinite(coursePrice)) {
            const feeId =
              M.studentFeeByEnrollment.get(enrollmentId) ?? M.studentFeeByStudent.get(uuid);
            if (feeId) {
              await apiMutate(`/fees/student-fees/${feeId}/`, "PATCH", {
                course: courseId,
                total_amount: coursePrice,
                discount_amount: 0,
              });
            }
          }
        } else if (courseId) {
          const created = await apiMutate<{ id?: string }>("/enrollments/enrollments/", "POST", {
            student: uuid,
            course: courseId,
            ...(batchId ? { batch: batchId } : {}),
            ...(coursePrice != null && Number.isFinite(coursePrice)
              ? { amount: coursePrice, discount_amount: 0 }
              : {}),
          });
          ok = ok && !!created;
          if (created?.id) {
            const approved = await apiMutate(
              `/enrollments/enrollments/${created.id}/approve/`,
              "POST",
              {},
            );
            ok = ok && !!approved;
          }
        }
      }
      return ok;
    }
    case "deactivateStudent": {
      const uuid = M.studentByCode.get(action.id);
      if (!uuid) return false;
      const result = await apiMutateDetailed(`/students/profiles/${uuid}/deactivate/`, "POST", {});
      return result.status >= 200 && result.status < 300;
    }
    case "reactivateStudent": {
      const uuid = M.studentByCode.get(action.id);
      if (!uuid) return false;
      const result = await apiMutateDetailed(`/students/profiles/${uuid}/reactivate/`, "POST", {});
      return result.status >= 200 && result.status < 300;
    }
    case "deleteStudent": {
      const uuid = M.studentByCode.get(action.id);
      if (!uuid) return false;
      return !!(await apiMutate(`/students/profiles/${uuid}/`, "DELETE"));
    }
    case "updateCourse": {
      const body: Record<string, unknown> = {};
      const p = action.patch;
      if (p.title) body.title = p.title;
      if (p.tagline || p.description) body.short_description = p.tagline || p.description;
      if (p.description) body.description = p.description;
      if (p.price != null) body.price = p.price;
      if (p.level) body.level = String(p.level).toUpperCase();
      if (p.mode) {
        const m = String(p.mode).toUpperCase();
        body.enrollment_type = m === "PHYSICAL" ? "PHYSICAL" : m === "HYBRID" ? "HYBRID" : "ONLINE";
      }
      if (p.duration != null) {
        const raw = String(p.duration);
        const n = Number((raw.match(/\d+/) || [])[0]);
        if (Number.isFinite(n) && n > 0) {
          body.duration_weeks = /month/i.test(raw) ? n * 4 : n;
        }
      }
      if (p.categories != null) {
        const names = Array.isArray(p.categories)
          ? p.categories.map(String).filter((n) => n.trim())
          : [];
        const ids: string[] = [];
        for (const name of names) {
          const id = await resolveOrCreateCategory(name);
          if (id) ids.push(id);
        }
        body.categories = ids;
      } else if (p.category != null && String(p.category).trim()) {
        const categoryId = await resolveOrCreateCategory(String(p.category));
        if (categoryId) body.categories = [categoryId];
      }
      if (p.instructor != null && String(p.instructor).trim()) {
        const teacherUuid = M.teacherByName.get(String(p.instructor));
        if (teacherUuid) body.primary_instructor_id = teacherUuid;
      }
      if (p.isPublished === true) {
        body.is_published = true;
        body.status = "PUBLISHED";
      } else if (p.isPublished === false) {
        body.is_published = false;
        body.status = "DRAFT";
      }
      let ok = Object.keys(body).length === 0
        ? true
        : !!(await apiMutate(courseEndpoints.detail(action.slug), "PATCH", body));

      const hasSeo =
        p.metaTitle != null ||
        p.metaDescription != null ||
        p.metaKeywords != null ||
        p.title != null;
      if (hasSeo) {
        const seoBody: Record<string, unknown> = {
          canonical_url: coursePublicPath(action.slug),
          slug: action.slug,
          is_indexed: true,
        };
        if (p.metaTitle != null) seoBody.meta_title = p.metaTitle;
        else if (p.title) seoBody.meta_title = p.title;
        if (p.metaDescription != null) seoBody.meta_description = p.metaDescription;
        if (p.metaKeywords != null) seoBody.meta_keywords = p.metaKeywords;
        if (p.metaTitle != null || p.title) seoBody.og_title = p.metaTitle || p.title;
        if (p.metaDescription != null) seoBody.og_description = p.metaDescription;
        const seoOk = !!(await apiMutate(courseEndpoints.seo(action.slug), "PATCH", seoBody));
        ok = ok && seoOk;
      }
      return ok;
    }
    case "createCourse": {
      const payload = { ...action.payload };
      // Resolve category name(s) → UUID list (API expects M2M ids)
      if (Array.isArray(payload.category_names)) {
        const ids: string[] = [];
        for (const name of payload.category_names as string[]) {
          if (!String(name).trim()) continue;
          const categoryId = await resolveOrCreateCategory(String(name));
          if (categoryId) ids.push(categoryId);
        }
        delete payload.category_names;
        payload.categories = ids;
      } else if (typeof payload.category_name === "string" && payload.category_name.trim()) {
        const categoryId = await resolveOrCreateCategory(payload.category_name);
        delete payload.category_name;
        if (categoryId) payload.categories = [categoryId];
      }
      if (typeof payload.instructor_name === "string" && payload.instructor_name.trim()) {
        const teacherUuid = M.teacherByName.get(String(payload.instructor_name));
        delete payload.instructor_name;
        if (teacherUuid) payload.primary_instructor_id = teacherUuid;
      }

      const result = await apiMutateDetailed<{ slug?: string; is_published?: boolean }>(
        courseEndpoints.list(),
        "POST",
        payload,
      );
      if (!result.data?.slug) {
        console.error("[createCourse]", result.error || "No slug returned", result.status);
        return false;
      }
      const slug = result.data.slug;
      // Publish only when needed — avoid a detail-route 404 from a mismatched client slug
      if (payload.is_published !== false && !result.data.is_published) {
        await apiMutate(courseEndpoints.publish(slug), "POST", {});
      }
      return slug;
    }
    case "publishCourse": {
      if (!action.slug?.trim()) return false;
      return !!(await apiMutate(courseEndpoints.publish(action.slug), "POST", {}));
    }
    case "unpublishCourse": {
      if (!action.slug?.trim()) return false;
      return !!(await apiMutate(courseEndpoints.unpublish(action.slug), "POST", {}));
    }
    case "createBatch": {
      const courseId = M.courseByTitle.get(action.payload.course);
      if (!courseId) {
        console.error("[createBatch] Unknown course:", action.payload.course);
        return false;
      }
      const body: Record<string, unknown> = {
        course: courseId,
        code: action.payload.code,
        name: action.payload.name || `${action.payload.course} (${action.payload.code})`,
        capacity: action.payload.capacity ?? 30,
        status: batchStatusToApi(action.payload.status) || "UPCOMING",
      };
      const startDate = parseBatchStartDate(action.payload.startDate);
      if (startDate) body.start_date = startDate;
      if (action.payload.teacher) {
        const teacherId = M.teacherByName.get(action.payload.teacher);
        if (teacherId) body.teacher = teacherId;
      }
      if (action.payload.shift) {
        const shiftId = M.shiftByName.get(action.payload.shift.toLowerCase());
        if (shiftId) body.shift = shiftId;
      }
      const result = await apiMutateDetailed<{ code?: string }>(
        batchEndpoints.list(),
        "POST",
        body,
      );
      if (!result.data?.code) {
        console.error("[createBatch]", result.error || "No code returned", result.status);
        return false;
      }
      return result.data.code;
    }
    case "updateBatch": {
      const uuid = M.batchByCode.get(action.id);
      if (!uuid) return false;
      const body: Record<string, unknown> = {};
      const p = action.patch;
      if (p.status) body.status = batchStatusToApi(String(p.status));
      if (p.capacity != null) body.capacity = p.capacity;
      if (p.teacher) {
        const teacherUuid = M.teacherByName.get(String(p.teacher));
        if (teacherUuid) body.teacher = teacherUuid;
      }
      if (Object.keys(body).length === 0) return false;
      return !!(await apiMutate(batchEndpoints.detail(uuid), "PATCH", body));
    }
    case "updateAssignment": {
      const uuid = M.assignmentByTitle.get(action.title);
      if (!uuid) return false;
      const body: Record<string, unknown> = {};
      const p = action.patch;
      if (p.status) body.status = assignmentStatusToApi(String(p.status));
      if (p.dueAt) body.due_date = p.dueAt;
      // Opening the portal publishes the assignment for students.
      if (p.portalOpen === true) {
        const published = await apiMutate(`/assignments/assignments/${uuid}/publish/`, "POST", {});
        if (published) return true;
        body.status = "PUBLISHED";
      } else if (p.portalOpen === false) {
        body.status = "DRAFT";
      }
      if (Object.keys(body).length === 0) return false;
      return !!(await apiMutate(`/assignments/assignments/${uuid}/`, "PATCH", body));
    }
    case "createAssignment": {
      const courseId = M.courseByTitle.get(action.course);
      const batchId = M.batchByCode.get(action.batch);
      if (!courseId) {
        console.error("[createAssignment] course not found", action.course);
        return false;
      }
      let teacherUuid = action.teacher ? M.teacherByName.get(action.teacher) : undefined;
      if (!teacherUuid && action.teacher) {
        const needle = action.teacher.trim().toLowerCase();
        for (const [name, id] of M.teacherByName.entries()) {
          if (name.trim().toLowerCase() === needle) {
            teacherUuid = id;
            break;
          }
        }
      }
      const status = action.portalOpen ? "PUBLISHED" : "DRAFT";
      const created = await apiMutateDetailed<{ id?: string }>("/assignments/assignments/", "POST", {
        title: action.title,
        course: courseId,
        batch: batchId || null,
        ...(teacherUuid ? { teacher: teacherUuid } : {}),
        due_date: action.dueAt,
        max_marks: action.maxMarks ?? 100,
        status,
        description: "",
        instructions: "",
        allow_late_submission: false,
      });
      if (!created.data?.id) {
        console.error("[createAssignment]", created.error || "No id returned", created.status);
        return false;
      }
      const assignmentId = String(created.data.id);
      if (action.studentId) {
        const studentUuid = M.studentByCode.get(action.studentId);
        if (studentUuid) {
          await apiMutate("/assignments/allocations/", "POST", {
            assignment: assignmentId,
            student: studentUuid,
            batch: null,
          });
        }
      } else if (batchId) {
        // Batch allocation is also created by backend perform_create; this is a safe fallback.
        await apiMutate("/assignments/allocations/", "POST", {
          assignment: assignmentId,
          batch: batchId,
          student: null,
        });
      }
      if (action.portalOpen) {
        await apiMutate(`/assignments/assignments/${assignmentId}/publish/`, "POST", {});
      }
      return true;
    }
    case "updateTask": {
      const body: Record<string, unknown> = {};
      const p = action.patch;
      if (p.status) body.status = taskStatusToApi(String(p.status));
      if (p.title) body.title = p.title;
      if (p.due) body.due = p.due;
      if (Object.keys(body).length === 0) return false;
      return !!(await apiMutate(`/tasks/board/${action.id}/`, "PATCH", body));
    }
    case "deleteTask":
      return !!(await apiMutate(`/tasks/board/${action.id}/`, "DELETE"));
    case "advanceTask":
      return !!(await apiMutate(`/tasks/board/${action.id}/advance/`, "POST", {}));
    case "createInvoice": {
      const today = new Date().toISOString().slice(0, 10);
      const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      return !!(await apiMutate("/fees/invoices/", "POST", {
        student_fee: action.studentFeeId,
        amount: action.amount,
        total_amount: action.amount,
        tax_amount: 0,
        status: "ISSUED",
        issue_date: today,
        due_date: due,
      }));
    }
    case "bulkAssignTasks":
      return !!(await apiMutate("/tasks/board/bulk-assign/", "POST", {
        title: action.title,
        course: action.course,
        due: action.due,
        batch_ids: action.batchIds,
        student_ids: action.studentIds,
        assigned_by: action.assignedBy,
      }));
    case "createTask": {
      const studentUuid = M.studentByCode.get(action.studentId);
      if (!studentUuid) return false;
      const courseId = action.course ? M.courseByTitle.get(action.course) : undefined;
      return !!(await apiMutate("/tasks/board/", "POST", {
        title: action.title,
        course: courseId || null,
        course_title: action.course || "",
        due: action.due || "TBD",
        status: "TO_DO",
        student: studentUuid,
        assigned_by: action.assignedBy || "",
        created_by_role: action.createdByRole || "admin",
      }));
    }
    case "updateSeo": {
      const id = M.seoByPath.get(action.path);
      if (!id) return false;
      const body: Record<string, unknown> = {};
      const p = action.patch;
      if (p.title != null) body.meta_title = p.title;
      if (p.description != null) body.meta_description = p.description;
      if (p.keywords != null) body.meta_keywords = p.keywords;
      if (p.canonical != null) body.canonical_url = p.canonical;
      if (p.ogImage != null) {
        // URL string only — file uploads go through dedicated media endpoints
        if (typeof p.ogImage === "string" && !p.ogImage.startsWith("blob:")) {
          body.og_title = p.title || undefined;
          body.og_description = p.description || undefined;
          // Store URL in structured_data if ImageField can't take remote URL via PATCH JSON
          // Prefer og_title/description; image URL as canonical social preview hint:
          body.structured_data = { og_image_url: p.ogImage };
        }
      }
      if (p.robots != null) body.robots = p.robots;
      if (Object.keys(body).length === 0) return false;
      return !!(await apiMutate(`/seo/metadata/${id}/`, "PATCH", body));
    }
    case "updateBlog":
      return !!(await apiMutate(`/cms/blog/${action.slug}/`, "PATCH", action.patch));
    case "createBlog":
      return !!(await apiMutate("/cms/blog/", "POST", action.payload));
    case "updateEvent":
      return !!(await apiMutate(`/cms/events/${action.slug}/`, "PATCH", action.patch));
    case "updateFaq":
      return !!(await apiMutate(`/cms/faqs/${action.id}/`, "PATCH", action.patch));
    case "reviewSubmission":
      return !!(await apiMutate(`/assignments/submissions/${action.id}/grade/`, "POST", {
        marks_obtained: action.score,
        feedback: action.feedback,
      }));
    default:
      return false;
  }
}

/** Fire-and-forget sync; callers may opt into a focused follow-up refresh. */
export function syncAfter(action: SyncAction, refresh?: () => Promise<void>) {
  if (!getAccessToken()) return;
  void runDashboardSync(action).finally(() => {
    if (refresh) void refresh();
  });
}

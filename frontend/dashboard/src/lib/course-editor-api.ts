/**
 * Course editor API — FAQs, class schedules, marketing fields on course detail.
 */

import { apiGet, apiList, apiMutateDetailed } from "@/lib/dashboard-api";
import { courseEndpoints } from "@/lib/api-endpoints";

export type CourseFaqRow = {
  id: string;
  course: string;
  question: string;
  answer: string;
  order: number;
};

export type ClassScheduleRow = {
  id?: string;
  uuid?: string;
  pk?: string | number;
  date?: string;
  class_date?: string;
  scheduled_date?: string;
  start_time?: string;
  end_time?: string;
  start?: string;
  end?: string;
  start_datetime?: string;
  end_datetime?: string;
  slots?: ClassScheduleSlot[];
};

type ClassScheduleSlot = {
  id?: string | number;
  uuid?: string;
  pk?: string | number;
  start_time?: string;
  end_time?: string;
  startTime?: string;
  endTime?: string;
  is_published?: boolean;
};

export type CourseHighlightInput = {
  heading: string;
  description: string;
};

export type CourseDetailRow = {
  id: string;
  slug: string;
  title: string;
  why_this_course_title?: string | null;
  highlights?: Array<{ heading?: string; description?: string; title?: string; body?: string }>;
  faqs?: CourseFaqRow[];
  meta_title?: string | null;
  meta_description?: string | null;
  og_image?: string | null;
};

function courseFaqsPath(courseId: string) {
  return `/courses/faqs/?course=${encodeURIComponent(courseId)}`;
}

function contentCourseFaqsPath(courseId: string) {
  return `/content/courses/${encodeURIComponent(courseId)}/faqs/`;
}

function contentCourseFaqDetailPath(id: string) {
  return `/content/course-faqs/${encodeURIComponent(id)}/`;
}

function classSchedulesPath(courseId: string) {
  return `/content/courses/${encodeURIComponent(courseId)}/class-schedules/`;
}

function classScheduleDetailPath(scheduleId: string) {
  return `/content/class-schedules/${encodeURIComponent(scheduleId)}/`;
}

function nestedClassScheduleDetailPath(courseId: string, scheduleId: string) {
  return `${classSchedulesPath(courseId)}${encodeURIComponent(scheduleId)}/`;
}

function scheduleRowId(row: ClassScheduleRow & Record<string, unknown>): string {
  const raw = row.id ?? row.uuid ?? row.pk;
  if (raw == null || raw === "") return "";
  return String(raw);
}

function mapScheduleRow(row: ClassScheduleRow): ClassScheduleRow {
  const r = row as ClassScheduleRow & Record<string, unknown>;
  const id = scheduleRowId(r);
  const start =
    typeof row.start_time === "string" && row.start_time
      ? row.start_time
      : typeof r.startTime === "string"
        ? r.startTime
        : "";
  const end =
    typeof row.end_time === "string" && row.end_time
      ? row.end_time
      : typeof r.endTime === "string"
        ? r.endTime
        : "";
  return {
    ...row,
    ...(id ? { id } : {}),
    date: row.date || row.class_date || row.scheduled_date || String(r.classDate || r.scheduledDate || ""),
    start_time: start,
    end_time: end,
    slots: undefined,
  };
}

/**
 * GET /class-schedules/ returns date groups:
 * `{ date, slots: [{ id, start_time, end_time }] }`.
 * Flatten so each slot is one row with the parent date.
 */
function flattenScheduleRows(rows: ClassScheduleRow[]): ClassScheduleRow[] {
  const out: ClassScheduleRow[] = [];
  for (const row of rows) {
    const r = row as ClassScheduleRow & Record<string, unknown>;
    const date =
      row.date ||
      row.class_date ||
      row.scheduled_date ||
      String(r.classDate || r.scheduledDate || "");
    const slots = Array.isArray(r.slots)
      ? r.slots
      : Array.isArray(r.time_slots)
        ? (r.time_slots as ClassScheduleSlot[])
        : null;

    if (slots) {
      for (const slot of slots) {
        if (!slot || typeof slot !== "object") continue;
        const s = slot as ClassScheduleSlot & ClassScheduleRow;
        out.push(
          mapScheduleRow({
            ...s,
            date,
            id: s.id != null ? String(s.id) : undefined,
            start_time: s.start_time,
            end_time: s.end_time,
          }),
        );
      }
      continue;
    }

    out.push(mapScheduleRow(row));
  }
  return out;
}

export const courseEditorApi = {
  async fetchCourseDetail(slug: string): Promise<CourseDetailRow | null> {
    return apiGet<CourseDetailRow>(courseEndpoints.detail(slug));
  },

  async listFaqs(courseId: string): Promise<CourseFaqRow[]> {
    const fromCourse = await apiList<CourseFaqRow>(courseFaqsPath(courseId));
    if (fromCourse.length) return fromCourse.sort((a, b) => a.order - b.order);
    const fromContent = await apiList<CourseFaqRow>(contentCourseFaqsPath(courseId));
    return fromContent.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },

  createFaq(payload: { course: string; question: string; answer: string; order?: number }) {
    const body = { order: payload.order ?? 0, ...payload };
    const post = (path: string) => apiMutateDetailed<CourseFaqRow>(path, "POST", body);
    return post("/courses/faqs/").then(async (res) => {
      if (res.error && (res.status === 404 || res.status === 405)) {
        return post(contentCourseFaqsPath(payload.course));
      }
      return res;
    });
  },

  updateFaq(id: string, payload: Partial<{ question: string; answer: string; order: number }>) {
    const patch = (path: string) => apiMutateDetailed<CourseFaqRow>(path, "PATCH", payload);
    return patch(`/courses/faqs/${encodeURIComponent(id)}/`).then(async (res) => {
      if (res.error && res.status === 404) {
        return patch(contentCourseFaqDetailPath(id));
      }
      return res;
    });
  },

  deleteFaq(id: string) {
    const del = (path: string) => apiMutateDetailed<void>(path, "DELETE");
    return del(`/courses/faqs/${encodeURIComponent(id)}/`).then(async (res) => {
      if (res.error && res.status === 404) {
        return del(contentCourseFaqDetailPath(id));
      }
      return res;
    });
  },

  patchCourse(
    slug: string,
    body: Partial<{
      why_this_course_title: string;
      highlights: CourseHighlightInput[];
      faqs: Array<{ question: string; answer: string; order?: number }>;
      meta_title: string;
      meta_description: string;
    }>,
  ) {
    return apiMutateDetailed<CourseDetailRow>(courseEndpoints.detail(slug), "PATCH", body);
  },

  listClassSchedules(courseId: string) {
    return apiList<ClassScheduleRow>(classSchedulesPath(courseId)).then(flattenScheduleRows);
  },

  createClassSchedule(
    courseId: string,
    payload: { date: string; start_time: string; end_time?: string | null },
  ) {
    return apiMutateDetailed<ClassScheduleRow>(
      classSchedulesPath(courseId),
      "POST",
      payload,
    );
  },

  updateClassSchedule(
    courseId: string,
    scheduleId: string,
    payload: { date?: string; start_time?: string; end_time?: string | null },
  ) {
    const patch = (path: string) => apiMutateDetailed<ClassScheduleRow>(path, "PATCH", payload);
    return patch(classScheduleDetailPath(scheduleId)).then(async (res) => {
      if (res.error && (res.status === 404 || res.status === 405)) {
        return patch(nestedClassScheduleDetailPath(courseId, scheduleId));
      }
      return res;
    });
  },

  deleteClassSchedule(courseId: string, scheduleId: string) {
    const del = (path: string) => apiMutateDetailed<void>(path, "DELETE");
    return del(classScheduleDetailPath(scheduleId)).then(async (res) => {
      if (res.error && (res.status === 404 || res.status === 405)) {
        return del(nestedClassScheduleDetailPath(courseId, scheduleId));
      }
      return res;
    });
  },
};

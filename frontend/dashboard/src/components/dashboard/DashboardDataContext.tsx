import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getAccessToken, apiAdminCreateUser } from "@/lib/api";
import { onAuthChanged } from "@/lib/auth-events";
import { fetchDashboardBundle, apiMutateDetailed, type DashboardBundle } from "@/lib/dashboard-api";
import { mapDashboardBundle } from "@/lib/dashboard-mappers";
import { buildEntityMaps, setEntityMaps, syncAfter, runDashboardSync } from "@/lib/dashboard-sync";
import { teacherEndpoints, batchEndpoints } from "@/lib/api-endpoints";
import { contentApi } from "@/lib/content-api";
import { useAuth } from "@/components/dashboard/AuthContext";
import {
  students as seedStudents,
  teachers as seedTeachers,
  courses as seedCourses,
  batches as seedBatches,
  shifts as seedShifts,
  assignments as seedAssignments,
  certificates as seedCertificates,
  seedTasks,
  blog as seedBlog,
  events as seedEvents,
  testimonials as seedTestimonials,
  faqs as seedFaqs,
  type Course,
  type BoardTask,
  type TaskStatus,
  TASK_STATUSES,
} from "@/lib/mock";

export type Student = (typeof seedStudents)[number];
export type Teacher = (typeof seedTeachers)[number];
export type Batch = (typeof seedBatches)[number];
export type Shift = (typeof seedShifts)[number];
export type Assignment = (typeof seedAssignments)[number];
export type Certificate = (typeof seedCertificates)[number];
export type { BoardTask, TaskStatus };
export { TASK_STATUSES };
export type TaskItem = { title: string; course: string; due: string };
export type TaskBoard = Record<string, TaskItem[]>;
export type BlogPost = (typeof seedBlog)[number];
export type EventItem = (typeof seedEvents)[number];
export type Testimonial = (typeof seedTestimonials)[number];
export type Faq = (typeof seedFaqs)[number];
export type SeoPage = {
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
export type PartResourceItem = {
  id: string;
  courseSlug: string;
  chapterIndex: number;
  partIndex: number;
  title: string;
  type: "video" | "notes" | "pdf" | "other";
  fileName: string;
  fileUrl: string | null;
  uploadedAt: string;
};
export type StudentSubmission = {
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
};

type HomepageContent = {
  heroTitle: string;
  heroCta: string;
  heroSubtitle: string;
  logoUrl: string | null;
};

type DashboardData = {
  students: Student[];
  teachers: Teacher[];
  courses: Course[];
  courseCategories: { id: string; name: string; slug: string }[];
  replaceCourseCategories: (cats: { id: string; name: string; slug: string }[]) => void;
  batches: Batch[];
  shifts: Shift[];
  assignments: Assignment[];
  certificates: Certificate[];
  tasks: BoardTask[];
  /** Derived kanban columns from tasks (compat) */
  taskBoard: TaskBoard;
  blog: BlogPost[];
  events: EventItem[];
  testimonials: Testimonial[];
  faqs: Faq[];
  seoPages: SeoPage[];
  homepage: HomepageContent;
  submissions: StudentSubmission[];

  addStudent: (s: Omit<Student, "id" | "avatar" | "progress" | "progressNote" | "fees" | "joined"> & Partial<Pick<Student, "progress" | "progressNote" | "fees">>) => Promise<{ temporaryPassword?: string; emailSent?: boolean; emailError?: string } | void>;
  updateStudent: (id: string, patch: Partial<Student>) => void;
  deactivateStudent: (id: string) => void;
  reactivateStudent: (id: string) => void;
  deleteStudent: (id: string) => void;
  importStudents: (rows: string[][]) => number;

  addTeacher: (t: Omit<Teacher, "avatar" | "courses"> & { courses?: number; email?: string; phone?: string }) => Promise<{ temporaryPassword?: string; emailSent?: boolean; emailError?: string } | void>;
  updateTeacher: (name: string, patch: Partial<Teacher>) => void;
  removeTeacher: (uuid: string) => void;
  assignCourseToTeacher: (teacherName: string, courseTitle: string) => void;
  assignCoursesToTeacher: (teacherName: string, courseTitles: string[]) => Promise<boolean>;
  assignBatchesToTeacher: (teacherName: string, batchIds: string[]) => Promise<boolean>;
  importTeachers: (rows: string[][]) => number;

  addCourse: (c: Omit<Course, "chapters" | "cover" | "rating" | "students" | "outcomes" | "tagline" | "description"> & Partial<Course> & { coverFile?: File }) => Promise<boolean>;
  updateCourse: (slug: string, patch: Partial<Course>) => void;
  /** Apply state already persisted by a dedicated content endpoint without re-syncing the course. */
  updateCourseLocal: (slug: string, patch: Partial<Course>) => void;
  removeCourse: (slug: string) => void;
  publishCourse: (slug: string, publish?: boolean) => void;
  importCourses: (rows: string[][]) => number;

  addBatch: (b: Batch) => Promise<boolean>;
  updateBatch: (id: string, patch: Partial<Batch>) => void;
  importBatches: (rows: string[][]) => number;

  addShift: (s: Shift) => void;
  updateShift: (id: string, patch: Partial<Shift>) => void;
  importShifts: (rows: string[][]) => number;

  addAssignment: (a: Assignment & { assignStudentId?: string }) => void;
  updateAssignment: (title: string, patch: Partial<Assignment>) => void;
  importAssignments: (rows: string[][]) => number;

  partResources: PartResourceItem[];
  addPartResource: (r: Omit<PartResourceItem, "id" | "fileName" | "fileUrl" | "uploadedAt"> & { partId: string; file: File }) => Promise<{ ok: boolean; detail?: string }>;
  removePartResource: (id: string) => Promise<{ ok: boolean; detail?: string }>;

  addCertificate: (c: Certificate) => void;
  importCertificates: (rows: string[][]) => number;

  addTask: (task: Omit<BoardTask, "id"> & { id?: string }) => void;
  updateTask: (id: string, patch: Partial<BoardTask>) => void;
  deleteTask: (id: string) => void;
  advanceTaskStatus: (id: string) => boolean;
  assignTasksToStudents: (input: {
    title: string;
    course: string;
    due: string;
    studentIds?: string[];
    batchIds?: string[];
    createdByName: string;
    createdByRole: BoardTask["createdByRole"];
    assignedBy?: string;
  }) => number;
  importTasks: (rows: string[][]) => number;

  submitAssignment: (s: Omit<StudentSubmission, "id" | "submittedAt" | "status">) => void;
  reviewSubmission: (id: string, score: number, feedback: string) => void;

  updateHomepage: (patch: Partial<HomepageContent>) => void;
  updateBlog: (slug: string, patch: Partial<BlogPost>) => void;
  addBlog: (post: BlogPost) => void;
  updateEvent: (title: string, patch: Partial<EventItem>) => void;
  updateTestimonial: (name: string, patch: Partial<Testimonial>) => void;
  updateFaq: (index: number, patch: Partial<Faq>) => void;
  updateSeoPage: (path: string, patch: Partial<SeoPage>) => void;

  /** `api` when hydrated from backend; empty until authenticated */
  dataSource: "api" | "mock";
  loading: boolean;
  /**
   * Re-fetch the full dashboard bundle.
   * Use `{ silent: true }` after mutations so the layout does not flash a full reload.
   * Prefer local optimistic updates + syncAfter without refresh for routine saves.
   */
  refreshData: (opts?: { silent?: boolean }) => Promise<void>;
};

const DashboardDataContext = createContext<DashboardData | null>(null);

function nextStudentId(list: Student[]) {
  const nums = list.map((s) => Number(s.id.replace(/\D/g, "")) || 1000);
  return `STU-${Math.max(1000, ...nums) + 1}`;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { authReady } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseCategories, setCourseCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [blog, setBlog] = useState<BlogPost[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [seoPages, setSeoPages] = useState<SeoPage[]>([]);
  const [homepage, setHomepage] = useState<HomepageContent>({
    heroTitle: "",
    heroCta: "",
    heroSubtitle: "",
    logoUrl: null,
  });
  const [partResources, setPartResources] = useState<PartResourceItem[]>([]);
  const [dataSource, setDataSource] = useState<"api" | "mock">("api");
  const [loading, setLoading] = useState(false);
  const bundleRef = useRef<DashboardBundle | null>(null);
  const refreshRequestRef = useRef(0);

  const applyMappedData = useCallback((bundle: DashboardBundle, mapped: ReturnType<typeof mapDashboardBundle>) => {
    bundleRef.current = bundle;
    setEntityMaps(buildEntityMaps(bundle));
    setStudents(mapped.students as Student[]);
    setTeachers(mapped.teachers as Teacher[]);
    setCourses(mapped.courses as Course[]);
    const resources = bundle.partResources.flatMap((resource) => {
      for (const course of mapped.courses) {
        for (const [chapterIndex, chapter] of course.chapters.entries()) {
          const partIndex = chapter.parts.findIndex((part) => String(part.id) === String(resource.part));
          if (partIndex < 0) continue;
          const fileUrl = resource.file || resource.external_url || null;
          const fileName = fileUrl
            ? decodeURIComponent(fileUrl.split("?")[0].split("/").pop() || resource.title)
            : resource.title;
          const resourceType = resource.resource_type.toUpperCase();
          return [{
            id: String(resource.id),
            courseSlug: course.slug,
            chapterIndex,
            partIndex,
            title: resource.title,
            type: resourceType === "PDF" ? "pdf" : resourceType === "DOC" ? "notes" : "other",
            fileName,
            fileUrl,
            uploadedAt: resource.created_at,
          } satisfies PartResourceItem];
        }
      }
      return [];
    });
    setPartResources(resources);
    setCourseCategories(
      (bundle.courseCategories || []).map((c) => ({
        id: String(c.id),
        name: c.name,
        slug: c.slug,
      })),
    );
    setBatches(mapped.batches as Batch[]);
    setShifts(mapped.shifts as Shift[]);
    setAssignments(mapped.assignments as Assignment[]);
    setCertificates(mapped.certificates as Certificate[]);
    setTasks(mapped.tasks);
    setSeoPages(mapped.seoPages);
    setSubmissions(mapped.submissions);
    setBlog(mapped.blog);
    setEvents(mapped.events);
    setFaqs(mapped.faqs);
    setTestimonials(mapped.testimonials);
    setDataSource("api");
  }, []);

  const refreshData = useCallback(async (opts?: { silent?: boolean }) => {
    const requestId = ++refreshRequestRef.current;
    const silent = Boolean(opts?.silent);
    if (!getAccessToken()) {
      setDataSource("mock");
      setStudents([]);
      setTeachers([]);
      setCourses([]);
      setCourseCategories([]);
      setBatches([]);
      setShifts([]);
      setAssignments([]);
      setCertificates([]);
      setTasks([]);
      setSubmissions([]);
      setBlog([]);
      setEvents([]);
      setTestimonials([]);
      setFaqs([]);
      setSeoPages([]);
      setHomepage({ heroTitle: "", heroCta: "", heroSubtitle: "", logoUrl: null });
      setPartResources([]);
      return;
    }
    // Initial/auth hydrate shows loading; post-mutation refreshes must stay silent
    // or every useDashboardData() consumer remounts as if the dashboard reloaded.
    if (!silent) setLoading(true);
    try {
      const bundle = await fetchDashboardBundle();
      // A newer refresh was requested while this request was in flight. Its data
      // is authoritative, so a late response must not replace current state.
      if (bundle && requestId === refreshRequestRef.current) {
        applyMappedData(bundle, mapDashboardBundle(bundle));
      }
    } catch (err) {
      console.error("[dashboard] failed to load API bundle", err);
    } finally {
      if (!silent && requestId === refreshRequestRef.current) setLoading(false);
    }
  }, [applyMappedData]);

  useEffect(() => {
    if (!authReady) return;
    void refreshData();
    return onAuthChanged(() => {
      void refreshData();
    });
  }, [authReady, refreshData]);

  const addStudent = useCallback(async (s: Parameters<DashboardData["addStudent"]>[0]) => {
    let temporaryPassword: string | undefined;
    let emailSent = false;
    let emailError: string | undefined;
    if (getAccessToken()) {
      const courseRow = courses.find((c) => c.title === s.course || c._uuid === s.course);
      const batchRow = batches.find(
        (b) => b.id === s.batch || b._uuid === s.batch || (courseRow && b.course === courseRow.title && b.id === s.batch),
      );
      if (!courseRow?._uuid) {
        throw new Error("Select a valid course");
      }
      if (!batchRow?._uuid) {
        throw new Error("Select a valid batch");
      }
      const created = await apiAdminCreateUser({
        email: s.email,
        name: s.name,
        phone: s.phone,
        role: "STUDENT",
        create_profile: true,
        send_email: true,
        course: courseRow._uuid,
        batch: batchRow._uuid,
      });
      if (!created.ok) {
        throw new Error(created.detail || "Could not create student account");
      }
      temporaryPassword = created.temporary_password;
      emailSent = Boolean(created.email_sent);
      emailError = created.email_error;
      void refreshData({ silent: true });
    }
    setStudents((prev) => {
      const id = nextStudentId(prev);
      const total = s.fees?.total ?? 0;
      const paid = s.fees?.paid ?? 0;
      return [
        {
          id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          course: s.course,
          batch: s.batch,
          shift: s.shift,
          status: s.status,
          progress: s.progress ?? 0,
          progressNote: s.progressNote,
          fees: { total, paid, due: total - paid },
          joined: new Date().toISOString().slice(0, 10),
          avatar: "",
          provisionalPassword: temporaryPassword || "",
          mustChangePassword: Boolean(temporaryPassword),
        } as Student,
        ...prev,
      ];
    });
    return { temporaryPassword, emailSent, emailError };
  }, [refreshData, courses, batches]);

  const updateStudent = useCallback((id: string, patch: Partial<Student>) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        if (patch.fees) {
          const total = patch.fees.total ?? s.fees.total;
          const paid = patch.fees.paid ?? s.fees.paid;
          next.fees = { total, paid, due: Math.max(0, total - paid) };
        } else if (patch.course != null && String(patch.course) !== s.course) {
          const course = courses.find((c) => c.title === patch.course);
          if (course) {
            const total = Number(course.price) || 0;
            const paid = next.fees.paid;
            next.fees = { total, paid, due: Math.max(0, total - paid) };
          }
        }
        return next;
      }),
    );
    syncAfter({ type: "updateStudent", id, patch });
  }, [courses]);

  const deactivateStudent = useCallback((id: string) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status: "Deactivated" as const } : s)));
    syncAfter({ type: "deactivateStudent", id });
  }, []);

  const reactivateStudent = useCallback((id: string) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status: "Active" as const } : s)));
    syncAfter({ type: "reactivateStudent", id });
  }, []);

  const deleteStudent = useCallback((id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    syncAfter({ type: "deleteStudent", id });
  }, []);

  const importStudents = useCallback((rows: string[][]) => {
    const data = rows.slice(1).filter((r) => r[1]);
    setStudents((prev) => {
      let list = [...prev];
      for (const r of data) {
        const id = r[0] || nextStudentId(list);
        if (list.some((s) => s.id === id)) continue;
        const total = Number(r[8]) || 0;
        list = [
          {
            id,
            name: r[1],
            email: r[2] || "",
            phone: r[3] || "",
            course: r[4] || "",
            batch: r[5] || "",
            shift: (r[6] as Student["shift"]) || "Evening",
            status: (["Active", "On Hold", "Completed", "Deactivated"].includes(r[7]) ? r[7] : "Active") as Student["status"],
            progress: 0,
            progressNote: undefined,
            fees: { total, paid: 0, due: total },
            joined: new Date().toISOString().slice(0, 10),
            avatar: "",
          },
          ...list,
        ];
      }
      return list;
    });
    return data.length;
  }, []);

  const addTeacher = useCallback(async (t: Parameters<DashboardData["addTeacher"]>[0]) => {
    const email =
      t.email?.trim() ||
      `${t.name.trim().toLowerCase().replace(/\s+/g, ".")}@shikshalab.io`;
    let temporaryPassword: string | undefined;
    let emailSent = false;
    let emailError: string | undefined;
    if (getAccessToken()) {
      const created = await apiAdminCreateUser({
        email,
        name: t.name,
        phone: t.phone,
        role: "TEACHER",
        create_profile: true,
        send_email: true,
      });
      if (!created.ok) {
        throw new Error(created.detail || "Could not create teacher account");
      }
      temporaryPassword = created.temporary_password;
      emailSent = Boolean(created.email_sent);
      emailError = created.email_error;
      void refreshData({ silent: true });
    }
    setTeachers((prev) => [
      {
        name: t.name,
        role: t.role,
        exp: t.exp,
        bio: t.bio,
        courses: t.courses ?? 0,
        avatar: "",
      },
      ...prev,
    ]);
    return { temporaryPassword, emailSent, emailError };
  }, [refreshData]);

  const updateTeacher = useCallback((name: string, patch: Partial<Teacher>) => {
    setTeachers((prev) => prev.map((t) => (t.name === name ? { ...t, ...patch } : t)));
  }, []);

  const removeTeacher = useCallback((uuid: string) => {
    setTeachers((prev) => prev.filter((t) => String(t._uuid) !== uuid));
  }, []);

  const assignCoursesToTeacher = useCallback(async (teacherName: string, courseTitles: string[]) => {
    const unique = [...new Set(courseTitles.filter(Boolean))];
    if (!unique.length) return false;

    // Optimistic UI update
    setCourses((prev) =>
      prev.map((c) => (unique.includes(c.title) ? { ...c, instructor: teacherName } : c)),
    );
    setTeachers((prev) =>
      prev.map((t) =>
        t.name === teacherName ? { ...t, courses: unique.length } : t,
      ),
    );

    if (!getAccessToken()) return true;

    const teacherRow = teachers.find((t) => t.name === teacherName);
    const uuid = teacherRow?._uuid;
    if (!uuid) {
      console.error("[dashboard] assignCoursesToTeacher: missing teacher uuid for", teacherName);
      return false;
    }

    const courseUuids = unique
      .map((title) => courses.find((c) => c.title === title)?._uuid)
      .filter((id): id is string => Boolean(id))
      .map(String);

    if (!courseUuids.length) {
      console.error("[dashboard] assignCoursesToTeacher: no course uuids resolved", unique);
      return false;
    }

    const res = await apiMutateDetailed(
      teacherEndpoints.assignCourses(String(uuid)),
      "POST",
      { course_ids: courseUuids, replace: true },
    );
    if (!res.data) {
      console.error("[dashboard] assignCoursesToTeacher failed", res.error);
      await refreshData({ silent: true });
      return false;
    }
    // Optimistic UI already applied — no full-bundle refresh
    return true;
  }, [teachers, courses, refreshData]);

  const assignCourseToTeacher = useCallback(
    (teacherName: string, courseTitle: string) => {
      void assignCoursesToTeacher(teacherName, [courseTitle]);
    },
    [assignCoursesToTeacher],
  );

  const assignBatchesToTeacher = useCallback(async (teacherName: string, batchIds: string[]) => {
    const unique = [...new Set(batchIds.filter(Boolean))];
    if (!unique.length) return false;

    setBatches((prev) =>
      prev.map((b) => (unique.includes(b.id) ? { ...b, teacher: teacherName } : b)),
    );
    setShifts((prev) =>
      prev.map((s) => (unique.includes(s.batch) ? { ...s, teacher: teacherName } : s)),
    );

    if (!getAccessToken()) return true;

    const teacherUuid = teachers.find((t) => t.name === teacherName)?._uuid;
    if (!teacherUuid) {
      console.error("[dashboard] assignBatchesToTeacher: missing teacher uuid");
      return false;
    }

    let ok = true;
    for (const code of unique) {
      const batchUuid = batches.find((b) => b.id === code)?._uuid;
      if (!batchUuid) {
        ok = false;
        continue;
      }
      const res = await apiMutateDetailed(batchEndpoints.detail(String(batchUuid)), "PATCH", {
        teacher: teacherUuid,
      });
      if (!res.data) ok = false;
    }
    // Optimistic UI already applied — skip full-bundle refresh
    return ok;
  }, [teachers, batches]);

  const importTeachers = useCallback((rows: string[][]) => {
    const data = rows.slice(1).filter((r) => r[0]);
    setTeachers((prev) => {
      const list = [...prev];
      for (const r of data) {
        if (list.some((t) => t.name === r[0])) continue;
        list.unshift({
          name: r[0],
          role: r[1] || "Instructor",
          exp: r[3] || "1 yr",
          courses: Number(r[4]) || 0,
          bio: `Imported instructor${r[2] ? ` (${r[2]})` : ""}.`,
          avatar: "",
        });
      }
      return list;
    });
    return data.length;
  }, []);

  const replaceCourseCategories = useCallback(
    (cats: { id: string; name: string; slug: string }[]) => {
      setCourseCategories(cats);
    },
    [],
  );

  const addCourse = useCallback(async (c: Parameters<DashboardData["addCourse"]>[0]) => {
    const slug = c.slug || slugify(c.title);
    const durationRaw = String(c.duration || "");
    const durationNum = Number((durationRaw.match(/\d+/) || [])[0]);
    const durationWeeks =
      Number.isFinite(durationNum) && durationNum > 0
        ? /month/i.test(durationRaw)
          ? durationNum * 4
          : durationNum
        : 12;
    const mode = String(c.mode || "Online").toUpperCase();
    const enrollment_type =
      mode === "PHYSICAL" ? "PHYSICAL" : mode === "HYBRID" ? "HYBRID" : "ONLINE";

    // Optimistic local row — empty cover until API thumbnail exists (no fake stock image)
    const categoryList =
      Array.isArray(c.categories) && c.categories.length
        ? c.categories
        : c.category
          ? [c.category]
          : [];
    setCourses((prev) => [
      {
        slug,
        title: c.title,
        category: categoryList[0] || "General",
        categories: categoryList,
        level: c.level,
        mode: c.mode,
        duration: c.duration,
        price: c.price,
        rating: c.rating ?? null,
        students: c.students ?? 0,
        instructor: c.instructor || "Unassigned",
        cover: c.cover && !c.cover.startsWith("blob:") ? c.cover : "",
        tagline: c.tagline || c.title,
        description: c.description || "",
        outcomes: c.outcomes || [],
        metaTitle: c.metaTitle,
        metaDescription: c.metaDescription,
        metaKeywords: c.metaKeywords,
        isPublished: true,
        chapters: c.chapters || [{ title: "Getting Started", parts: [{ title: "Welcome", type: "video", duration: "10:00" }] }],
      },
      ...prev,
    ]);

    const created = await runDashboardSync({
      type: "createCourse",
      payload: {
        title: c.title,
        short_description: c.tagline || c.title,
        description: c.description || "",
        price: c.price,
        level: String(c.level || "Beginner").toUpperCase(),
        enrollment_type,
        duration_weeks: durationWeeks,
        learning_outcomes: c.outcomes || [],
        is_published: true,
        status: "PUBLISHED",
        is_featured: false,
        language: "English",
        // Resolved to UUIDs inside createCourse sync (not hardcoded paths/ids)
        category_names: categoryList,
        instructor_name: c.instructor || "",
      },
    });
    if (created) {
      const realSlug = typeof created === "string" ? created : slug;
      // Upload thumbnail AFTER the course exists on the API
      if (c.coverFile) {
        const { uploadCourseThumbnail } = await import("@/lib/api");
        const uploaded = await uploadCourseThumbnail(realSlug, c.coverFile);
        if (uploaded) {
          setCourses((prev) =>
            prev.map((row) =>
              row.slug === slug || row.slug === realSlug
                ? { ...row, slug: realSlug, cover: uploaded }
                : row,
            ),
          );
        }
      }
      await refreshData({ silent: true });
      return true;
    }
    return false;
  }, [refreshData]);

  const updateCourseLocal = useCallback((slug: string, patch: Partial<Course>) => {
    setCourses((prev) =>
      prev.map((c) => {
        if (c.slug !== slug) return c;
        const next = { ...c, ...patch };
        if (patch.categories) {
          next.category = patch.categories[0] || next.category;
        }
        return next;
      }),
    );
  }, []);

  const removeCourse = useCallback((slug: string) => {
    setCourses((prev) => prev.filter((c) => c.slug !== slug));
  }, []);

  const updateCourse = useCallback((slug: string, patch: Partial<Course>) => {
    updateCourseLocal(slug, patch);
    syncAfter({ type: "updateCourse", slug, patch });
  }, [updateCourseLocal]);

  const publishCourse = useCallback((slug: string, publish = true) => {
    setCourses((prev) =>
      prev.map((c) => (c.slug === slug ? { ...c, isPublished: publish } : c)),
    );
    syncAfter(
      publish ? { type: "publishCourse", slug } : { type: "unpublishCourse", slug },
    );
  }, []);

  const importCourses = useCallback((rows: string[][]) => {
    const data = rows.slice(1).filter((r) => r[1]);
    setCourses((prev) => {
      const list = [...prev];
      for (const r of data) {
        const slug = r[0] || slugify(r[1]);
        if (list.some((c) => c.slug === slug)) continue;
        list.unshift({
          slug,
          title: r[1],
          category: r[2] || "Programming",
          categories: [r[2] || "Programming"],
          level: (["Beginner", "Intermediate", "Advanced"].includes(r[3]) ? r[3] : "Beginner") as Course["level"],
          mode: (["Physical", "Online", "Hybrid"].includes(r[4]) ? r[4] : "Online") as Course["mode"],
          duration: r[5] || "3 months",
          price: Number(r[6]) || 25000,
          rating: null,
          students: 0,
          instructor: "Unassigned",
          cover: "",
          tagline: r[1],
          description: "",
          outcomes: [],
          chapters: [{ title: "Getting Started", parts: [{ title: "Welcome", type: "video", duration: "10:00" }] }],
        });
      }
      return list;
    });
    return data.length;
  }, []);

  const addBatch = useCallback(async (b: Batch) => {
    setBatches((prev) => [b, ...prev]);
    if (!getAccessToken()) return true;
    const created = await runDashboardSync({
      type: "createBatch",
      payload: {
        code: b.id,
        name: `${b.course} — ${b.id}`,
        course: b.course,
        teacher: b.teacher,
        shift: b.shift,
        capacity: b.capacity,
        status: b.status,
        startDate: b.start,
      },
    });
    if (created) {
      await refreshData({ silent: true });
      return true;
    }
    await refreshData({ silent: true });
    return false;
  }, [refreshData]);

  const updateBatch = useCallback((id: string, patch: Partial<Batch>) => {
    setBatches((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    syncAfter({ type: "updateBatch", id, patch });
  }, []);

  const importBatches = useCallback((rows: string[][]) => {
    const data = rows.slice(1).filter((r) => r[0]);
    setBatches((prev) => {
      const list = [...prev];
      for (const r of data) {
        if (list.some((b) => b.id === r[0])) continue;
        list.unshift({
          id: r[0],
          course: r[1] || "",
          teacher: r[2] || "Unassigned",
          shift: r[3] || "Evening",
          capacity: Number(r[4]) || 30,
          enrolled: 0,
          start: r[5] || "TBD",
          status: (r[6] === "Ongoing" || r[6] === "Upcoming" ? r[6] : "Upcoming") as Batch["status"],
        });
      }
      return list;
    });
    return data.length;
  }, []);

  const addShift = useCallback((s: Shift) => {
    setShifts((prev) => [...prev, s]);
  }, []);

  const updateShift = useCallback((id: string, patch: Partial<Shift>) => {
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const importShifts = useCallback((rows: string[][]) => {
    const data = rows.slice(1).filter((r) => r[0]);
    setShifts((prev) => {
      const list = [...prev];
      for (const r of data) {
        const id = r[0];
        if (list.some((s) => s.id === id)) continue;
        list.push({
          id,
          course: r[1] || "",
          batch: r[2] || "",
          teacher: r[3] || "",
          startTime: r[4] || "09:00",
          endTime: r[5] || "12:00",
          days: r[6] || "Mon–Fri",
        });
      }
      return list;
    });
    return data.length;
  }, []);

  const addAssignment = useCallback((a: Assignment & { assignStudentId?: string }) => {
    const { assignStudentId, ...assignment } = a;
    setAssignments((prev) => [assignment, ...prev]);
    syncAfter(
      {
        type: "createAssignment",
        title: assignment.title,
        course: assignment.course,
        batch: assignment.batch,
        dueAt: assignment.dueAt,
        teacher: assignment.teacher,
        portalOpen: Boolean(assignment.portalOpen),
        studentId: assignStudentId,
      },
    );
  }, []);

  const updateAssignment = useCallback((title: string, patch: Partial<Assignment>) => {
    setAssignments((prev) => prev.map((a) => (a.title === title ? { ...a, ...patch } : a)));
    syncAfter({ type: "updateAssignment", title, patch });
  }, []);

  useEffect(() => {
    const closeExpired = () => {
      const now = Date.now();
      setAssignments((prev) => {
        let changed = false;
        const next = prev.map((a) => {
          if (!a.portalOpen || !a.dueAt) return a;
          if (new Date(a.dueAt).getTime() <= now) {
            changed = true;
            return {
              ...a,
              portalOpen: false,
              status: a.status === "Active" ? ("Completed" as const) : a.status,
            };
          }
          return a;
        });
        return changed ? next : prev;
      });
    };
    closeExpired();
    const timer = window.setInterval(closeExpired, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const importAssignments = useCallback((rows: string[][]) => {
    const data = rows.slice(1).filter((r) => r[0]);
    setAssignments((prev) => {
      const list = [...prev];
      for (const r of data) {
        if (list.some((a) => a.title === r[0])) continue;
        list.unshift({
          title: r[0],
          course: r[1] || "",
          batch: r[2] || "",
          due: r[3] || "TBD",
          dueAt: r[6] || "",
          submissions: 0,
          total: 30,
          status: (["Active", "Grading", "Completed"].includes(r[4]) ? r[4] : "Active") as Assignment["status"],
          teacher: r[5] || "",
          portalOpen: false,
        });
      }
      return list;
    });
    return data.length;
  }, []);

  const addPartResource = useCallback(async (r: Parameters<DashboardData["addPartResource"]>[0]) => {
    const result = await contentApi.uploadPartResource({
      part: r.partId,
      title: r.title,
      type: r.type,
      file: r.file,
    });
    if (!result.ok || !result.data) return { ok: false, detail: result.detail || "Upload failed" };
    const data = result.data;
    setPartResources((prev) => [{
      id: String(data.id),
      courseSlug: r.courseSlug,
      chapterIndex: r.chapterIndex,
      partIndex: r.partIndex,
      title: data.title,
      type: r.type,
      fileName: r.file.name,
      fileUrl: data.file || data.external_url || null,
      uploadedAt: data.created_at,
    }, ...prev]);
    return { ok: true };
  }, []);

  const removePartResource = useCallback(async (id: string) => {
    const result = await contentApi.deletePartResource(id);
    if (!result.ok) return { ok: false, detail: result.detail || "Deletion failed" };
    setPartResources((prev) => prev.filter((r) => r.id !== id));
    return { ok: true };
  }, []);


  const addCertificate = useCallback((c: Certificate) => {
    setCertificates((prev) => [c, ...prev]);
  }, []);

  const importCertificates = useCallback((rows: string[][]) => {
    const data = rows.slice(1).filter((r) => r[0]);
    setCertificates((prev) => {
      const list = [...prev];
      for (const r of data) {
        if (list.some((c) => c.code === r[0])) continue;
        list.unshift({
          code: r[0],
          student: r[1] || "Unknown",
          course: r[2] || "",
          issued: r[3] || new Date().toISOString().slice(0, 10),
          status: r[4] === "Revoked" ? "Revoked" : "Valid",
        });
      }
      return list;
    });
    return data.length;
  }, []);

  const addTask = useCallback((task: Omit<BoardTask, "id"> & { id?: string }) => {
    setTasks((prev) => [
      {
        ...task,
        id: task.id || `TSK-${Date.now()}-${prev.length}`,
        status: task.status || "To Do",
      },
      ...prev,
    ]);
    syncAfter(
      {
        type: "createTask",
        title: task.title,
        course: task.course,
        due: task.due,
        studentId: task.studentId,
        assignedBy: task.assignedBy || task.createdByName,
        createdByRole: task.createdByRole,
      },
    );
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<BoardTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    syncAfter({ type: "updateTask", id, patch });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    syncAfter({ type: "deleteTask", id });
  }, []);

  const advanceTaskStatus = useCallback((id: string) => {
    let advanced = false;
    setTasks((prev) => {
      const current = prev.find((t) => t.id === id);
      if (!current) return prev;
      const idx = TASK_STATUSES.indexOf(current.status);
      if (idx < 0 || idx >= TASK_STATUSES.length - 1) return prev;
      advanced = true;
      const next = TASK_STATUSES[idx + 1];
      return prev.map((t) => (t.id === id ? { ...t, status: next } : t));
    });
    if (advanced) syncAfter({ type: "advanceTask", id });
    return advanced;
  }, []);

  const assignTasksToStudents = useCallback(
    (input: {
      title: string;
      course: string;
      due: string;
      studentIds?: string[];
      batchIds?: string[];
      createdByName: string;
      createdByRole: BoardTask["createdByRole"];
      assignedBy?: string;
    }) => {
      let targetIds = input.studentIds || [];
      if (input.batchIds?.length) {
        const batchSet = new Set(input.batchIds);
        targetIds = students.filter((s) => batchSet.has(s.batch)).map((s) => s.id);
      }
      const stamp = Date.now();
      setTasks((prev) => {
        const created: BoardTask[] = targetIds.map((sid, i) => {
          const student = students.find((s) => s.id === sid);
          return {
            id: `TSK-${stamp}-${i}`,
            title: input.title,
            course: input.course,
            due: input.due,
            status: "To Do" as TaskStatus,
            studentId: sid,
            studentName: student?.name || sid,
            createdByRole: input.createdByRole,
            createdByName: input.createdByName,
            assignedBy: input.assignedBy || input.createdByName,
          };
        });
        return [...created, ...prev];
      });
      syncAfter(
        {
          type: "bulkAssignTasks",
          title: input.title,
          course: input.course,
          due: input.due,
          batchIds: input.batchIds,
          studentIds: input.batchIds?.length ? undefined : targetIds,
          assignedBy: input.assignedBy || input.createdByName,
        },
      );
      return targetIds.length;
    },
    [students],
  );

  const importTasks = useCallback((rows: string[][]) => {
    const data = rows.slice(1).filter((r) => r[0]);
    setTasks((prev) => {
      const next = [...prev];
      for (const r of data) {
        const status = (TASK_STATUSES.includes(r[3] as TaskStatus) ? r[3] : "To Do") as TaskStatus;
        next.unshift({
          id: `TSK-IMP-${Date.now()}-${next.length}`,
          title: r[0],
          course: r[1] || "",
          due: r[2] || "TBD",
          status,
          studentId: r[4] || "STU-1000",
          studentName: r[5] || "Student",
          createdByRole: "admin",
          createdByName: "Import",
        });
      }
      return next;
    });
    return data.length;
  }, []);

  const submitAssignment = useCallback((s: Omit<StudentSubmission, "id" | "submittedAt" | "status">) => {
    setSubmissions((prev) => [
      {
        ...s,
        id: `SUB-${Date.now()}`,
        submittedAt: new Date().toISOString(),
        status: "submitted",
      },
      ...prev.filter((x) => !(x.assignmentTitle === s.assignmentTitle && x.studentId === s.studentId)),
    ]);
    setAssignments((prev) =>
      prev.map((a) =>
        a.title === s.assignmentTitle
          ? { ...a, submissions: Math.min(a.total, a.submissions + 1), status: a.status === "Completed" ? a.status : "Grading" }
          : a,
      ),
    );
  }, []);

  const reviewSubmission = useCallback((id: string, score: number, feedback: string) => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, score, feedback, status: "reviewed" as const } : s)),
    );
    syncAfter({ type: "reviewSubmission", id, score, feedback });
  }, []);

  const updateHomepage = useCallback((patch: Partial<HomepageContent>) => {
    setHomepage((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateBlog = useCallback((slug: string, patch: Partial<BlogPost>) => {
    setBlog((prev) => prev.map((b) => (b.slug === slug ? { ...b, ...patch } : b)));
    syncAfter(
      {
        type: "updateBlog",
        slug,
        patch: {
          title: patch.title,
          excerpt: patch.excerpt,
        },
      },
    );
  }, []);

  const addBlog = useCallback((post: BlogPost) => {
    setBlog((prev) => [post, ...prev]);
    syncAfter(
      {
        type: "createBlog",
        payload: {
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          is_published: true,
        },
      },
    );
  }, []);

  const updateEvent = useCallback((title: string, patch: Partial<EventItem>) => {
    setEvents((prev) => prev.map((e) => (e.title === title ? { ...e, ...patch } : e)));
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    syncAfter({ type: "updateEvent", slug, patch: { title: patch.title, location: patch.location } });
  }, []);

  const updateTestimonial = useCallback((name: string, patch: Partial<Testimonial>) => {
    setTestimonials((prev) => prev.map((t) => (t.name === name ? { ...t, ...patch } : t)));
  }, []);

  const updateFaq = useCallback((index: number, patch: Partial<Faq>) => {
    setFaqs((prev) => {
      const next = prev.map((f, i) => (i === index ? { ...f, ...patch } : f));
      const faq = bundleRef.current?.cmsFaqs[index];
      if (faq?.id != null) {
        syncAfter(
          {
            type: "updateFaq",
            id: faq.id,
            patch: { question: patch.q, answer: patch.a },
          },
        );
      }
      return next;
    });
  }, []);

  const updateSeoPage = useCallback((path: string, patch: Partial<SeoPage>) => {
    setSeoPages((prev) => prev.map((p) => (p.path === path ? { ...p, ...patch } : p)));
    syncAfter({ type: "updateSeo", path, patch });
  }, []);

  const taskBoard = useMemo<TaskBoard>(() => {
    const board: TaskBoard = {
      "To Do": [],
      "In Progress": [],
      Submitted: [],
      Completed: [],
    };
    for (const t of tasks) {
      const col = board[t.status] ? t.status : "To Do";
      board[col] = [...(board[col] || []), { title: t.title, course: t.course, due: t.due }];
    }
    return board;
  }, [tasks]);

  const value = useMemo<DashboardData>(
    () => ({
      students,
      teachers,
      courses,
      courseCategories,
      replaceCourseCategories,
      batches,
      shifts,
      assignments,
      certificates,
      tasks,
      taskBoard,
      blog,
      events,
      testimonials,
      faqs,
      seoPages,
      homepage,
      submissions,
      addStudent,
      updateStudent,
      deactivateStudent,
      reactivateStudent,
      deleteStudent,
      importStudents,
      addTeacher,
      updateTeacher,
      removeTeacher,
      assignCourseToTeacher,
      assignCoursesToTeacher,
      assignBatchesToTeacher,
      importTeachers,
      addCourse,
      updateCourse,
      updateCourseLocal,
      removeCourse,
      publishCourse,
      importCourses,
      addBatch,
      updateBatch,
      importBatches,
      addShift,
      updateShift,
      importShifts,
      addAssignment,
      updateAssignment,
      importAssignments,
      partResources,
      addPartResource,
      removePartResource,
      addCertificate,
      importCertificates,
      addTask,
      updateTask,
      deleteTask,
      advanceTaskStatus,
      assignTasksToStudents,
      importTasks,
      submitAssignment,
      reviewSubmission,
      updateHomepage,
      updateBlog,
      addBlog,
      updateEvent,
      updateTestimonial,
      updateFaq,
      updateSeoPage,
      dataSource,
      loading,
      refreshData,
    }),
    [
      students, teachers, courses, courseCategories, batches, shifts, assignments, certificates, tasks, taskBoard, submissions,
      blog, events, testimonials, faqs, seoPages, homepage, partResources,
      dataSource, loading, refreshData,
      replaceCourseCategories,
      addStudent, updateStudent, deactivateStudent, reactivateStudent, deleteStudent, importStudents,
      addTeacher, updateTeacher, removeTeacher, assignCourseToTeacher, assignCoursesToTeacher, assignBatchesToTeacher, importTeachers,
      addCourse, updateCourse, updateCourseLocal, removeCourse, publishCourse, importCourses,
      addBatch, updateBatch, importBatches,
      addShift, updateShift, importShifts,
      addAssignment, updateAssignment, importAssignments,
      addPartResource, removePartResource,
      addCertificate, importCertificates,
      addTask, updateTask, deleteTask, advanceTaskStatus, assignTasksToStudents, importTasks,
      submitAssignment, reviewSubmission,
      updateHomepage, updateBlog, addBlog, updateEvent, updateTestimonial, updateFaq, updateSeoPage,
    ],
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) throw new Error("useDashboardData must be used within DashboardDataProvider");
  return ctx;
}

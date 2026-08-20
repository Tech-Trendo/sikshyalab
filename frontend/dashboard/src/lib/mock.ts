/** Shared domain types for the dashboard. Live data comes from the API — no seed rows. */

export type Course = {
  slug: string;
  title: string;
  /** Primary category label (first selected) — kept for display / filters */
  category: string;
  /** All category names assigned to this course */
  categories: string[];
  level: "Beginner" | "Intermediate" | "Advanced";
  mode: "Physical" | "Online" | "Hybrid";
  duration: string;
  price: number;
  /** Null until computed from live reviews / API — never invent a score */
  rating: number | null;
  students: number;
  instructor: string;
  cover: string;
  tagline: string;
  description: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  ogImage?: string;
  whyThisCourseTitle?: string;
  highlights?: { heading: string; description: string }[];
  faqs?: { id?: string; question: string; answer: string }[];
  outcomes: string[];
  createdAt?: string;
  /** Visible on the public site when true */
  isPublished?: boolean;
  /** Backend course UUID for content API */
  _uuid?: string;
  chapters: {
    id?: string;
    title: string;
    video?: {
      id?: string;
      title?: string;
      url?: string;
      duration?: number;
      parts?: {
        id?: string | number;
        title: string;
        start_time: number;
        end_time: number;
        order?: number;
      }[];
    } | null;
    parts: {
      id?: string;
      title: string;
      type: "video" | "pdf" | "notes";
      duration?: string;
      videoUrl?: string;
      notes?: string;
      description?: string;
      topics?: { id?: string; title: string }[];
    }[];
  }[];
};

export const TASK_STATUSES = ["To Do", "In Progress", "Submitted", "Completed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type BoardTask = {
  id: string;
  title: string;
  course: string;
  due: string;
  status: TaskStatus;
  studentId: string;
  studentName: string;
  createdByRole: "admin" | "teacher" | "student";
  createdByName: string;
  assignedBy?: string;
};

/** Empty placeholders — kept so legacy imports compile; never used as UI data. */
export const categories: { name: string; icon: string; count: number }[] = [];
export const courses: Course[] = [];
export const teachers: {
  name: string;
  role: string;
  exp: string;
  courses: number;
  avatar: string;
  bio: string;
  email?: string;
  phone?: string;
  _uuid?: string;
}[] = [];
export const testimonials: {
  name: string;
  role: string;
  quote: string;
  avatar: string;
}[] = [];
export const upcomingBatches: {
  course: string;
  start: string;
  shift: string;
  seats: number;
  mode: string;
}[] = [];
export const faqs: { q: string; a: string }[] = [];
export const blog: {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  cover: string;
}[] = [];
export const events: {
  title: string;
  date: string;
  time: string;
  location: string;
  tag: string;
  slug?: string;
  description?: string;
  cover?: string;
}[] = [];
export const gallery: string[] = [];
export const students: {
  id: string;
  name: string;
  email: string;
  phone: string;
  course: string;
  batch: string;
  shift: string;
  status: "Active" | "On Hold" | "Completed" | "Deactivated";
  progress: number;
  progressNote?: string;
  fees: { total: number; paid: number; due: number };
  joined: string;
  avatar: string;
  provisionalPassword?: string;
  mustChangePassword?: boolean;
  _uuid?: string;
  _studentFeeId?: string;
}[] = [];
export const batches: {
  id: string;
  course: string;
  teacher: string;
  shift: string;
  capacity: number;
  enrolled: number;
  start: string;
  status: string;
  _uuid?: string;
}[] = [];
export const shifts: {
  id: string;
  course: string;
  batch: string;
  teacher: string;
  startTime: string;
  endTime: string;
  days: string;
}[] = [];
export const certificates: {
  code: string;
  student: string;
  course: string;
  issued: string;
  status: string;
  supervisorName?: string;
  startDate?: string;
  endDate?: string;
  skills?: string;
}[] = [];
export const assignments: {
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
}[] = [];
export const seedTasks: BoardTask[] = [];
export const taskBoard: Record<string, { title: string; course: string; due: string }[]> = {
  "To Do": [],
  "In Progress": [],
  Submitted: [],
  Completed: [],
};
export const revenueSeries: { month: string; revenue: number }[] = [];
export const enrollmentsSeries: { month: string; students: number }[] = [];
export const jobs: { title: string; type: string; location: string; exp: string }[] = [];

export { inr, formatNpr } from "./currency";
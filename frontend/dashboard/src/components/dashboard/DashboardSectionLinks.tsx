import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import type { Role } from "@/components/dashboard/AuthContext";

export type SectionLink = { to: string; label: string; icon?: LucideIcon };

const linksByRole: Record<Role, Record<string, SectionLink[]>> = {
  admin: {
    "/dashboard": [
      { to: "/dashboard/students", label: "Students" },
      { to: "/dashboard/batches", label: "Batches" },
      { to: "/dashboard/courses", label: "Courses" },
      { to: "/dashboard/fees", label: "Fees" },
      { to: "/dashboard/tasks", label: "Tasks" },
      { to: "/dashboard/reviews", label: "Reviews" },
    ],
    "/dashboard/courses": [
      { to: "/dashboard/categories", label: "Categories" },
      { to: "/dashboard/batches", label: "Batches" },
      { to: "/dashboard/students", label: "Students" },
      { to: "/dashboard/fees", label: "Fees" },
    ],
    "/dashboard/categories": [
      { to: "/dashboard/courses", label: "Courses" },
      { to: "/dashboard/batches", label: "Batches" },
    ],
    "/dashboard/fees": [
      { to: "/dashboard/students", label: "Students" },
      { to: "/dashboard/courses", label: "Courses" },
      { to: "/dashboard/batches", label: "Batches" },
    ],
    "/dashboard/tasks": [
      { to: "/dashboard/students", label: "Students" },
      { to: "/dashboard/batches", label: "Batches" },
      { to: "/dashboard/courses", label: "Courses" },
    ],
    "/dashboard/reviews": [
      { to: "/dashboard/testimonials", label: "Testimonials" },
      { to: "/dashboard/courses", label: "Courses" },
    ],
    "/dashboard/students": [
      { to: "/dashboard/batches", label: "Batches" },
      { to: "/dashboard/fees", label: "Fees" },
      { to: "/dashboard/tasks", label: "Tasks" },
    ],
    "/dashboard/batches": [
      { to: "/dashboard/students", label: "Students" },
      { to: "/dashboard/courses", label: "Courses" },
      { to: "/dashboard/tasks", label: "Tasks" },
    ],
  },
  teacher: {
    "/dashboard": [
      { to: "/dashboard/batches", label: "My batches" },
      { to: "/dashboard/students", label: "Students" },
      { to: "/dashboard/assignments", label: "Assignments" },
      { to: "/dashboard/tasks", label: "Tasks" },
    ],
    "/dashboard/tasks": [
      { to: "/dashboard/students", label: "Students" },
      { to: "/dashboard/batches", label: "Batches" },
      { to: "/dashboard/assignments", label: "Assignments" },
    ],
  },
  student: {
    "/dashboard": [
      { to: "/dashboard/courses", label: "My courses" },
      { to: "/dashboard/tasks", label: "Tasks" },
      { to: "/dashboard/assignments", label: "Assignments" },
      { to: "/dashboard/fees", label: "Fees" },
    ],
    "/dashboard/fees": [
      { to: "/dashboard/courses", label: "My courses" },
      { to: "/dashboard/certificates", label: "Certificates" },
    ],
  },
};

type Props = {
  role: Role;
  section: string;
  className?: string;
};

export function DashboardSectionLinks({ role, section, className }: Props) {
  const links = linksByRole[role]?.[section] || [];
  if (!links.length) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Related</span>
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {link.label}
          <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}
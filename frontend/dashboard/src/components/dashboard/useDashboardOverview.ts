import { useEffect, useState } from "react";
import { useAuth } from "@/components/dashboard/AuthContext";
import { useDashboardData } from "@/components/dashboard/DashboardDataContext";
import { useTeacherScope } from "@/components/dashboard/useTeacherScope";
import { useStudentScope } from "@/components/dashboard/useStudentScope";
import { fetchRoleDashboardOverview } from "@/lib/api";
import {
  buildAdminOverview,
  buildStudentOverview,
  buildTeacherOverview,
  type DashboardOverview,
} from "@/lib/dashboard-logic";

/**
 * Loads role dashboard KPIs from backend when JWT is present;
 * otherwise uses the same frontend scoping logic as the UI.
 */
export function useDashboardOverview() {
  const { isTeacher, isStudent, isAdmin } = useAuth();
  const data = useDashboardData();
  const teacher = useTeacherScope();
  const student = useStudentScope();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const localFallback = (): DashboardOverview => {
      if (isTeacher) {
        return buildTeacherOverview({
          courses: teacher.myCourses,
          batches: teacher.myBatches,
          students: teacher.myStudents,
          assignments: teacher.myAssignments,
        });
      }
      if (isStudent) {
        return buildStudentOverview({
          me: student.me,
          courses: student.myCourses,
          assignments: student.myAssignments,
          tasks: student.myTasks,
          certificates: student.myCertificates,
          openAssignments: student.openAssignments,
        });
      }
      return buildAdminOverview({
        students: data.students,
        batches: data.batches,
        courses: data.courses,
      });
    };

    (async () => {
      setLoading(true);
      const rolePath = isTeacher ? "teacher" : isStudent ? "student" : "admin";
      const api = await fetchRoleDashboardOverview(rolePath);
      if (cancelled) return;
      if (api && typeof api.role === "string") {
        setOverview({
          ...(api as unknown as DashboardOverview),
          source: "api",
          generated_at: String(api.generated_at || new Date().toISOString()),
          kpis: (api.kpis as Record<string, number | string>) || {},
          role: api.role as DashboardOverview["role"],
        });
      } else {
        setOverview(localFallback());
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isTeacher,
    isStudent,
    isAdmin,
    teacher.myCourses,
    teacher.myBatches,
    teacher.myStudents,
    teacher.myAssignments,
    student.me,
    student.myCourses,
    student.myAssignments,
    student.myTasks,
    student.myCertificates,
    student.openAssignments,
    data.students,
    data.batches,
    data.courses,
  ]);

  return { overview: overview ?? (isTeacher
    ? buildTeacherOverview({
        courses: teacher.myCourses,
        batches: teacher.myBatches,
        students: teacher.myStudents,
        assignments: teacher.myAssignments,
      })
    : isStudent
      ? buildStudentOverview({
          me: student.me,
          courses: student.myCourses,
          assignments: student.myAssignments,
          tasks: student.myTasks,
          certificates: student.myCertificates,
          openAssignments: student.openAssignments,
        })
      : buildAdminOverview({
          students: data.students,
          batches: data.batches,
          courses: data.courses,
        })), loading };
}

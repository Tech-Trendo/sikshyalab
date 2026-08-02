import { useMemo } from "react";
import { useAuth } from "@/components/dashboard/AuthContext";
import { useDashboardData } from "@/components/dashboard/DashboardDataContext";

/** Scope dashboard data to the signed-in student. */
export function useStudentScope() {
  const { user, isStudent } = useAuth();
  const data = useDashboardData();
  const studentId = user.studentId || "";

  return useMemo(() => {
    const me =
      (studentId ? data.students.find((s) => s.id === studentId) : undefined) ||
      data.students.find((s) => s.email && user.email && s.email.toLowerCase() === user.email.toLowerCase()) ||
      (isStudent ? data.students[0] : undefined);
    const resolvedId = me?.id || studentId;
    const paid = me ? me.fees.due === 0 || me.fees.paid > 0 : false;
    const myCourses = me && paid
      ? data.courses.filter((c) => c.title === me.course)
      : [];
    // For students, /assignments/ and /tasks/board/ are already scoped by the API.
    const myAssignments = isStudent
      ? data.assignments
      : me
        ? data.assignments.filter((a) => a.batch === me.batch || a.course === me.course)
        : [];
    const myTasks = isStudent
      ? data.tasks
      : data.tasks.filter((t) => t.studentId === resolvedId);
    const mySubmissions = data.submissions.filter((s) => s.studentId === resolvedId);
    const myCertificates = me
      ? data.certificates.filter((c) => c.student === me.name)
      : [];

    return {
      isStudent,
      studentId: resolvedId,
      me,
      paid,
      myCourses,
      myAssignments,
      myTasks,
      mySubmissions,
      myCertificates,
      openAssignments: myAssignments.filter(
        (a) => a.portalOpen && (!a.dueAt || new Date(a.dueAt).getTime() > Date.now()),
      ),
    };
  }, [isStudent, studentId, user.email, data.students, data.courses, data.assignments, data.tasks, data.submissions, data.certificates]);
}

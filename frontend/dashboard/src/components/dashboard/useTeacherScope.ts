import { useMemo } from "react";
import { useAuth } from "@/components/dashboard/AuthContext";
import { useDashboardData } from "@/components/dashboard/DashboardDataContext";

/** Scope dashboard data to the signed-in teacher (or return full data for admin). */
export function useTeacherScope() {
  const { user, isTeacher, isAdmin } = useAuth();
  const data = useDashboardData();
  const teacherName = user.teacherName || user.name;

  return useMemo(() => {
    if (!isTeacher) {
      return {
        isTeacher,
        isAdmin,
        teacherName,
        myCourses: data.courses,
        myBatches: data.batches,
        myStudents: data.students,
        myAssignments: data.assignments,
        batchIds: data.batches.map((b) => b.id),
      };
    }

    const myBatches = data.batches.filter((b) => b.teacher === teacherName);
    const batchIds = new Set(myBatches.map((b) => b.id));
    const courseTitles = new Set(myBatches.map((b) => b.course));
    const myCourses = data.courses.filter(
      (c) => c.instructor === teacherName || courseTitles.has(c.title),
    );
    const myStudents = data.students.filter((s) => batchIds.has(s.batch));
    const myAssignments = data.assignments.filter((a) => a.teacher === teacherName);

    return {
      isTeacher,
      isAdmin,
      teacherName,
      myCourses,
      myBatches,
      myStudents,
      myAssignments,
      batchIds: [...batchIds],
    };
  }, [isTeacher, isAdmin, teacherName, data.courses, data.batches, data.students, data.assignments]);
}

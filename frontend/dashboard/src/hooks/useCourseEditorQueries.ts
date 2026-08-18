import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  courseEditorApi,
  type ClassScheduleRow,
  type CourseDetailRow,
  type CourseFaqRow,
  type CourseHighlightInput,
} from "@/lib/course-editor-api";

export const courseEditorKeys = {
  all: ["course-editor"] as const,
  detail: (slug: string) => [...courseEditorKeys.all, "detail", slug] as const,
  faqs: (courseUuid: string) => [...courseEditorKeys.all, "faqs", courseUuid] as const,
  schedules: (courseUuid: string) =>
    [...courseEditorKeys.all, "schedules", courseUuid] as const,
};

const queryDefaults = {
  staleTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export function useCourseEditorDetailQuery(slug: string, enabled = true) {
  return useQuery({
    queryKey: courseEditorKeys.detail(slug),
    queryFn: () => courseEditorApi.fetchCourseDetail(slug),
    enabled: enabled && Boolean(slug),
    ...queryDefaults,
  });
}

export function useCourseFaqsQuery(courseUuid: string, enabled = true) {
  return useQuery({
    queryKey: courseEditorKeys.faqs(courseUuid),
    queryFn: () => courseEditorApi.listFaqs(courseUuid),
    enabled: enabled && Boolean(courseUuid),
    ...queryDefaults,
  });
}

export function useCourseClassSchedulesQuery(courseUuid: string, enabled = true) {
  return useQuery({
    queryKey: courseEditorKeys.schedules(courseUuid),
    queryFn: () => courseEditorApi.listClassSchedules(courseUuid),
    enabled: enabled && Boolean(courseUuid),
    ...queryDefaults,
  });
}

export function usePatchCourseMarketingMutation(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      why_this_course_title: string;
      highlights: CourseHighlightInput[];
    }) => courseEditorApi.patchCourse(slug, body),
    onSuccess: (res) => {
      if (!res.error && res.data) {
        qc.setQueryData<CourseDetailRow | null>(courseEditorKeys.detail(slug), res.data);
      }
    },
  });
}

export function useCourseFaqMutations(courseUuid: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: courseEditorKeys.faqs(courseUuid) });

  const create = useMutation({
    mutationFn: (payload: { question: string; answer: string; order?: number }) =>
      courseEditorApi.createFaq({ course: courseUuid, ...payload }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<{ question: string; answer: string; order: number }>;
    }) => courseEditorApi.updateFaq(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => courseEditorApi.deleteFaq(id),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export function useCourseScheduleMutations(courseUuid: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: courseEditorKeys.schedules(courseUuid) });

  const create = useMutation({
    mutationFn: (payload: { date: string; start_time: string; end_time?: string | null }) =>
      courseEditorApi.createClassSchedule(courseUuid, payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      scheduleId,
      payload,
    }: {
      scheduleId: string;
      payload: { date?: string; start_time?: string; end_time?: string | null };
    }) => courseEditorApi.updateClassSchedule(courseUuid, scheduleId, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (scheduleId: string) =>
      courseEditorApi.deleteClassSchedule(courseUuid, scheduleId),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export type { ClassScheduleRow, CourseDetailRow, CourseFaqRow, CourseHighlightInput };

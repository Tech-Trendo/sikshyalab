import type { Course as MockCourse } from "@/lib/mock";
import type { Course as DataCourse } from "@/lib/data";
import type { CourseCardProps } from "@/components/home/CourseCard";

function lessonCountFromChapters(chapters: MockCourse["chapters"] | unknown): number {
  if (!Array.isArray(chapters)) return 0;
  return chapters.reduce((n, ch) => {
    const parts = ch && typeof ch === "object" && Array.isArray(ch.parts) ? ch.parts : [];
    return n + parts.length;
  }, 0);
}

/** Map public API course → CourseCard props */
export function courseToCardProps(course: MockCourse): CourseCardProps {
  const lessonsCount = lessonCountFromChapters(course.chapters);

  return {
    imageUrl: course.cover || "",
    duration: course.duration,
    level: course.level,
    category: course.category,
    title: course.title,
    slug: course.slug,
    rating: course.rating,
    ratingCount: Math.max(1, Math.round(course.students / 200) || 1),
    price: course.price,
    description: course.description || course.tagline,
    lessonsCount: lessonsCount || 0,
    studentsCount: course.students || 0,
  };
}

/** @deprecated Use courseToCardProps */
export const mockCourseToCardProps = courseToCardProps;

/** Map landing data course → CourseCard props */
export function dataCourseToCardProps(course: DataCourse): CourseCardProps {
  return {
    imageUrl: course.image,
    duration: "15 Hours",
    level: "Beginner",
    title: course.title,
    rating: course.rating,
    ratingCount: 1,
    price: course.price,
    description: `Learn ${course.title} with ${course.instructor.name}. Hands-on projects and mentor support included.`,
    lessonsCount: course.lessons,
    studentsCount: 5,
  };
}

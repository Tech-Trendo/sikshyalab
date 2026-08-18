import type { Metadata } from "next";
import { fetchPublicCourse } from "@/lib/public-api";
import { metadataFromEntity, stripToPlain } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = await fetchPublicCourse(slug);
  const title = course?.title || slug.replace(/-/g, " ");
  const description =
    stripToPlain(course?.short_description || course?.description) ||
    "Explore this ShikshaLab course — curriculum and enrollment.";
  return metadataFromEntity(course, {
    title,
    description,
    path: `/courses/${slug}`,
    image: course?.og_image || course?.thumbnail || course?.banner || null,
  });
}

export default function CourseSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}

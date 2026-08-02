import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata("/courses", {
    title: "Courses",
    description: "Browse ShikshaLab courses — web, data, cloud, and more.",
  });
}

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

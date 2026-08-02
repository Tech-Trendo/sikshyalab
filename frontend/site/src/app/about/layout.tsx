import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata("/about", {
    title: "About",
    description: "Learn about ShikshaLab — live classes, projects, and career-ready training.",
  });
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}

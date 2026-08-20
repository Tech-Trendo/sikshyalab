import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata("/gallery", {
    title: "Gallery",
    description: "A look at learning, projects, and community at ShikshaLab.",
  });
}

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children;
}

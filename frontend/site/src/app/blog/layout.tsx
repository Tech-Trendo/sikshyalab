import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata("/blog", {
    title: "Blog",
    description:
      "Expert guides and practical learning insights from ShikshaLab mentors.",
  });
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}

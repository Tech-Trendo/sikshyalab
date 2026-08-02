import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return getPageMetadata(`/blog/${slug}`, {
    title: slug.replace(/-/g, " "),
    description: "ShikshaLab blog article.",
  });
}

export default function BlogSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return getPageMetadata(`/events/${slug}`, {
    title: slug.replace(/-/g, " "),
    description: "ShikshaLab event details and registration.",
  });
}

export default function EventSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata("/testimonials", {
    title: "Testimonials",
    description:
      "Real feedback from graduates who completed ShikshaLab courses.",
  });
}

export default function TestimonialsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

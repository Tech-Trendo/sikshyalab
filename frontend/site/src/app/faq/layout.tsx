import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata("/faq", {
    title: "FAQ",
    description: "Answers to common questions about learning at ShikshaLab.",
  });
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}

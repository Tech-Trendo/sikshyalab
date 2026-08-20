import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata("/terms", {
    title: "Terms & Conditions",
    description: "Terms that govern your access to and use of the ShikshaLab platform.",
  });
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

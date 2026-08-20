import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata("/privacy", {
    title: "Privacy Policy",
    description: "How ShikshaLab collects, uses, and shares information about you.",
  });
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}

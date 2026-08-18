import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata("/sitemap", {
    title: "Sitemap",
    description: "Browse the full public page structure of ShikshaLab.",
  });
}

export default function SitemapLayout({ children }: { children: React.ReactNode }) {
  return children;
}

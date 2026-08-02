import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata("/contact", {
    title: "Contact",
    description: "Get in touch with ShikshaLab — email, phone, and campus details.",
  });
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}

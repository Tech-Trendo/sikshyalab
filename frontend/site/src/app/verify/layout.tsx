import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata("/verify", {
    title: "Verify certificate",
    description: "Check whether a ShikshaLab certificate is valid.",
  });
}

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}

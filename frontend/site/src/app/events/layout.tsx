import type { Metadata } from "next";
import { getPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return getPageMetadata("/events", {
    title: "Events",
    description: "Workshops, hackathons, and alumni get-togethers at ShikshaLab.",
  });
}

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

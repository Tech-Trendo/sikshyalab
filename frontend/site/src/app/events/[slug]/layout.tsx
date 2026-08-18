import type { Metadata } from "next";
import { fetchPublicEvent } from "@/lib/public-api";
import { metadataFromEntity, stripToPlain } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await fetchPublicEvent(slug);
  const title = event?.title || slug.replace(/-/g, " ");
  const description =
    stripToPlain(event?.description) || "ShikshaLab event details and registration.";
  return metadataFromEntity(event, {
    title,
    description,
    path: `/events/${slug}`,
    image: event?.og_image || event?.cover_image || null,
  });
}

export default function EventSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import { fetchPublicBlogPost } from "@/lib/public-api";
import { metadataFromEntity, stripToPlain } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPublicBlogPost(slug);
  const firstSection = [...(post?.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
  const title = post?.title || slug.replace(/-/g, " ");
  const description =
    stripToPlain(firstSection?.description) ||
    stripToPlain(post?.excerpt) ||
    stripToPlain(post?.content) ||
    "ShikshaLab blog article.";
  return metadataFromEntity(post, {
    title,
    description,
    path: `/blog/${slug}`,
    image: post?.og_image || post?.cover_image || null,
  });
}

export default function BlogSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}

"use client";

import { renderBlogContent } from "@/lib/markdown";
import { cn } from "@/lib/utils";

type Props = {
  content: string;
  className?: string;
};

/** Renders blog body Markdown/HTML with prose styles. */
export function BlogContent({ content, className }: Props) {
  const html = renderBlogContent(content);
  if (!html) {
    return <p className="text-sm text-black">No article content yet.</p>;
  }
  return (
    <div
      className={cn(
        "prose prose-neutral max-w-none overflow-x-auto text-black",
        "prose-headings:font-secondary prose-headings:text-brand-navy-dark",
        "prose-a:text-brand-orange prose-strong:text-brand-navy-dark",
        "prose-p:text-black prose-li:text-black prose-li:marker:text-brand-navy",
        "prose-pre:overflow-x-auto prose-table:block prose-table:w-full prose-table:overflow-x-auto",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

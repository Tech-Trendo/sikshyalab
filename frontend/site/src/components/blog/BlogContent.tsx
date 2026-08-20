"use client";

import { renderBlogContent } from "@/lib/markdown";
import { cn } from "@/lib/utils";

type Props = {
  content: string;
  className?: string;
  emptyMessage?: string | null;
};

/** Renders blog/course Markdown/HTML with prose styles. */
export function BlogContent({
  content,
  className,
  emptyMessage = "No article content yet.",
}: Props) {
  const html = renderBlogContent(content);
  if (!html) {
    return emptyMessage ? <p className="text-sm text-black">{emptyMessage}</p> : null;
  }
  return (
    <div
      className={cn(
        "prose prose-neutral max-w-none overflow-x-auto text-black",
        "prose-headings:font-secondary prose-headings:text-black",
        "prose-a:text-brand-orange prose-strong:text-black",
        "prose-p:text-black prose-li:text-black prose-li:marker:text-black",
        "[&_u]:underline",
        "[&_img]:my-3 [&_img]:h-auto [&_img]:w-full [&_img]:rounded-brand-lg [&_img]:object-cover",
        "prose-pre:overflow-x-auto prose-table:block prose-table:w-full prose-table:overflow-x-auto",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

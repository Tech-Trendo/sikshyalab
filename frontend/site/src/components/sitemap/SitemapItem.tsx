"use client";

import Link from "next/link";
import { lastUpdatedLabel, type SitemapNode } from "@/components/sitemap/sitemap-utils";
import { cn } from "@/lib/utils";

export function SitemapItem({
  node,
  depth = 0,
}: {
  node: SitemapNode;
  depth?: number;
}) {
  const updated = lastUpdatedLabel(node.entry);
  const status =
    typeof node.entry?.is_active === "boolean"
      ? node.entry.is_active
        ? "Active"
        : "Inactive"
      : null;

  return (
    <li>
      <div
        className={cn(
          "flex flex-col gap-1 rounded-lg px-3 py-2.5 transition-colors hover:bg-brand-orange/5 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
          depth > 0 && "ml-3 border-l border-brand-border/80 sm:ml-5",
        )}
      >
        <div className="min-w-0">
          {node.entry ? (
            <Link
              href={node.path}
              className="font-semibold text-[#181818] underline-offset-2 transition-colors hover:text-brand-navy hover:underline"
            >
              {node.title}
            </Link>
          ) : (
            <span className="font-semibold text-[#181818]">{node.title}</span>
          )}
          <p className="mt-0.5 break-all font-mono text-xs text-brand-body">{node.path}</p>
        </div>
        {(updated || status) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-brand-body">
            {updated ? <span>Last updated {updated}</span> : null}
            {status ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-semibold",
                  node.entry?.is_active
                    ? "bg-brand-navy/10 text-brand-navy"
                    : "bg-brand-border/80 text-brand-body",
                )}
              >
                {status}
              </span>
            ) : null}
          </div>
        )}
      </div>
      {node.children.length > 0 && (
        <ul className="mt-0.5 space-y-0.5" aria-label={`Pages under ${node.title}`}>
          {node.children.map((child) => (
            <SitemapItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

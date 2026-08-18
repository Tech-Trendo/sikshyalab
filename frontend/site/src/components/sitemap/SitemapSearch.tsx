"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SitemapSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor="sitemap-search" className="sr-only">
        Search pages
      </Label>
      <Input
        id="sitemap-search"
        name="q"
        type="search"
        autoComplete="off"
        placeholder="Search pages by title or URL…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-brand border-brand-border"
        aria-label="Search pages by title or URL"
      />
    </div>
  );
}

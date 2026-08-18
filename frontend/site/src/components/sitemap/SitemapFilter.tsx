"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SitemapFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { key: string; title: string }[];
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor="sitemap-filter" className="sr-only">
        Filter by section
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id="sitemap-filter"
          className="h-11 rounded-brand border-brand-border"
          aria-label="Filter by section"
        >
          <SelectValue placeholder="All sections" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sections</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.key} value={option.key}>
              {option.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

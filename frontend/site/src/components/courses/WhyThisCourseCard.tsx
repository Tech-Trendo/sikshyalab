"use client";

import { Check } from "lucide-react";
import type { Course } from "@/lib/mock";

export function WhyThisCourseCard({
  title,
  highlights,
}: {
  title?: string;
  highlights?: Course["highlights"];
}) {
  const heading = (title || "").trim();
  const points = Array.isArray(highlights)
    ? highlights.filter((item) => item.heading.trim() || item.description.trim())
    : [];

  if (!heading || points.length === 0) return null;

  return (
    <aside className="rounded-brand-lg bg-brand-lighten-02 p-6 shadow-brand-soft">
      <h3 className="font-secondary text-base font-bold text-[#181818]">{heading}</h3>
      <ul className="mt-4 space-y-4">
        {points.map((item, i) => (
          <li key={`${item.heading}-${i}`} className="flex items-start gap-2.5">
            <Check
              className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-navy"
              strokeWidth={2.75}
              aria-hidden
            />
            <p className="min-w-0 text-justify text-sm leading-relaxed text-brand-body sm:text-[15px]">
              {item.heading ? (
                <span className="font-bold text-[#181818]">{item.heading} </span>
              ) : null}
              {item.description}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Course } from "@/lib/mock";
import { cn } from "@/lib/utils";

function partKey(chapterIndex: number, partIndex: number) {
  return `${chapterIndex}-${partIndex}`;
}

function chapterLabel(index: number, title: string) {
  const trimmed = title.trim();
  const stripped = trimmed.replace(/^chapter\s*\d+\s*:\s*/i, "");
  return `Chapter ${index + 1}: ${stripped || trimmed}`;
}

function defaultOpenState(chapters: Course["chapters"]) {
  const chaptersOpen = new Set<number>();
  const partsOpen = new Set<string>();
  if (chapters.length) {
    chaptersOpen.add(0);
    if (chapters[0].parts?.length) partsOpen.add(partKey(0, 0));
  }
  return { chaptersOpen, partsOpen };
}

function PartToggleIcon({ open }: { open: boolean }) {
  return (
    <span
      className="w-5 shrink-0 text-center text-[17px] font-normal leading-none text-[#181818] select-none"
      aria-hidden
    >
      {open ? "−" : "+"}
    </span>
  );
}

export function CourseCurriculum({
  course,
}: {
  course: Course;
}) {
  const chapters = Array.isArray(course.chapters) ? course.chapters : [];
  const [openChapters, setOpenChapters] = useState(
    () => defaultOpenState(chapters).chaptersOpen,
  );
  const [openParts, setOpenParts] = useState(
    () => defaultOpenState(chapters).partsOpen,
  );

  const allChapterKeys = chapters.map((_, i) => i);
  const allPartKeys = chapters.flatMap((ch, i) =>
    (Array.isArray(ch.parts) ? ch.parts : []).map((_, j) => partKey(i, j)),
  );
  const allExpanded =
    allChapterKeys.length > 0 &&
    allChapterKeys.every((i) => openChapters.has(i)) &&
    allPartKeys.every((k) => openParts.has(k));

  const toggleAll = () => {
    if (allExpanded) {
      setOpenChapters(new Set());
      setOpenParts(new Set());
      return;
    }
    setOpenChapters(new Set(allChapterKeys));
    setOpenParts(new Set(allPartKeys));
  };

  const toggleChapter = (index: number) => {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const togglePart = (key: string) => {
    setOpenParts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-secondary text-lg font-bold text-[#181818]">Course Content</h4>
        {chapters.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="shrink-0 pt-0.5 text-sm font-semibold text-[#181818] transition-colors hover:text-brand-navy"
          >
            {allExpanded ? "Collapse All" : "Expand All"}
          </button>
        )}
      </div>

      {chapters.length ? (
        <div className="mt-4 overflow-hidden rounded-md bg-brand-shade">
          {chapters.map((ch, i) => {
            const parts = Array.isArray(ch.parts) ? ch.parts : [];
            const chapterOpen = openChapters.has(i);
            return (
              <div
                key={ch.title + i}
                className="border-b border-black/10 last:border-b-0"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-3.5 text-left sm:px-5 sm:py-4"
                  onClick={() => toggleChapter(i)}
                  aria-expanded={chapterOpen}
                >
                  <span className="min-w-0 font-bold text-[#181818]">
                    {chapterLabel(i, ch.title)}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-[#181818] transition-transform duration-300 ease-in-out",
                      chapterOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {chapterOpen && (
                  <div className="pb-2">
                    {parts.map((p, j) => {
                      const key = partKey(i, j);
                      const partOpen = openParts.has(key);
                      const topics = Array.isArray(p.topics) ? p.topics : [];
                      const label = `${i + 1}.${j + 1} ${p.title}`;
                      return (
                        <div key={p.title + j}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left sm:px-5"
                            onClick={() => togglePart(key)}
                            aria-expanded={partOpen}
                          >
                            <PartToggleIcon open={partOpen} />
                            <span className="min-w-0 font-bold text-[#181818]">{label}</span>
                          </button>
                          {partOpen && topics.length > 0 && (
                            <ul className="list-disc space-y-1 pb-2 pl-[3.25rem] pr-3 marker:text-[#181818]/40 sm:pl-[4.25rem] sm:pr-5">
                              {topics.map((t, k) => (
                                <li
                                  key={t.id || `${key}-${k}`}
                                  className="py-0.5 text-sm font-normal leading-relaxed text-[#181818]"
                                >
                                  {t.title}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-brand-body">
          Curriculum outline will be published soon. Contact us to learn more about the syllabus.
        </p>
      )}
    </div>
  );
}

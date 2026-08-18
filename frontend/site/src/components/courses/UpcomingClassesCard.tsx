"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchCourseClassSchedules, type PublicClassSchedule } from "@/lib/public-api";

type ClassEntry = {
  id: string;
  dateKey: string;
  dateLabel: string;
  timeLabel: string;
  sortAt: number;
};

type DateGroup = {
  dateKey: string;
  dateLabel: string;
  times: string[];
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseDateTime(raw?: string | null): Date | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const iso = new Date(trimmed);
  if (!Number.isNaN(iso.getTime()) && /t/i.test(trimmed)) return iso;
  const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    const d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseTime(raw?: string | null, onDate?: Date): Date | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/t/i.test(trimmed) || trimmed.includes(" ")) {
    const dt = parseDateTime(trimmed);
    if (dt) return dt;
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const base = onDate ? new Date(onDate) : new Date();
  base.setHours(Number(match[1]), Number(match[2]), Number(match[3] || 0), 0);
  return base;
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeLabel(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function dateKeyOf(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeSchedules(rows: PublicClassSchedule[]): ClassEntry[] {
  const now = Date.now();
  const entries: ClassEntry[] = [];

  rows.forEach((row, index) => {
    const dateRaw = row.date || row.class_date || row.scheduled_date || row.start_datetime || "";
    const date = parseDateTime(dateRaw) || parseDateTime(row.start_time);
    if (!date) return;

    const start = parseTime(row.start_time || row.start || row.start_datetime, date);
    const end = parseTime(row.end_time || row.end || row.end_datetime, date);
    if (!start || !end) return;

    const sortAt = start.getTime();
    if (end.getTime() < now) return;

    entries.push({
      id: row.id != null ? String(row.id) : `${dateKeyOf(date)}-${sortAt}-${index}`,
      dateKey: dateKeyOf(date),
      dateLabel: formatDateLabel(date),
      timeLabel: `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`,
      sortAt,
    });
  });

  return entries.sort((a, b) => a.sortAt - b.sortAt || a.timeLabel.localeCompare(b.timeLabel));
}

function groupByDate(entries: ClassEntry[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.dateKey === entry.dateKey) {
      last.times.push(entry.timeLabel);
    } else {
      groups.push({
        dateKey: entry.dateKey,
        dateLabel: entry.dateLabel,
        times: [entry.timeLabel],
      });
    }
  }
  return groups;
}

function ClassDateBlock({ group }: { group: DateGroup }) {
  return (
    <div className="py-2.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#181818]">
        <CalendarDays className="h-4 w-4 shrink-0 text-brand-navy" aria-hidden />
        <span>{group.dateLabel}</span>
      </div>
      <div className="mt-1 space-y-0.5 pl-6 text-sm text-brand-body">
        {group.times.map((time, i) => (
          <p key={`${group.dateKey}-${time}-${i}`}>{time}</p>
        ))}
      </div>
    </div>
  );
}

export function UpcomingClassesCard({
  courseId,
  courseTitle,
}: {
  courseId?: string;
  courseTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["public", "class-schedules", courseId],
    enabled: Boolean(courseId),
    queryFn: () => fetchCourseClassSchedules(courseId || ""),
    staleTime: 60_000,
  });

  const entries = useMemo(() => normalizeSchedules(query.data ?? []), [query.data]);
  const preview = useMemo(() => groupByDate(entries.slice(0, 3)), [entries]);
  const allGroups = useMemo(() => groupByDate(entries), [entries]);
  const remaining = Math.max(0, entries.length - 3);

  if (!courseId || query.isLoading || query.isError || entries.length === 0) {
    return null;
  }

  return (
    <>
      <aside className="rounded-brand-lg bg-white p-6 shadow-brand-soft">
        <h3 className="font-secondary text-base font-bold text-[#181818]">
          Upcoming Classes ({entries.length})
        </h3>
        <div className="mt-2 divide-y divide-brand-border/80">
          {preview.map((group) => (
            <ClassDateBlock key={group.dateKey} group={group} />
          ))}
        </div>
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 text-sm font-semibold text-[#181818] transition-colors hover:text-brand-navy"
          >
            See{" "}
            <span className="text-brand-orange">
              {remaining} more {remaining === 1 ? "class" : "classes"}
            </span>{" "}
            ↓
          </button>
        )}
      </aside>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto border border-brand-border bg-white shadow-brand-med !backdrop-blur-none [background:white] sm:w-full">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="font-secondary text-xl font-bold text-[#181818]">
              Upcoming Classes
            </DialogTitle>
            <DialogDescription className="text-sm text-brand-body">
              <span className="font-semibold text-brand-orange">{entries.length}</span>
              {" "}upcoming classes from selected course
            </DialogDescription>
            <p className="pt-1 text-sm font-semibold text-[#181818]">{courseTitle}</p>
          </DialogHeader>
          <div className="space-y-2">
            {allGroups.map((group) => (
              <div
                key={group.dateKey}
                className="rounded-xl border border-brand-border/70 bg-brand-shade/60 px-4 py-3"
              >
                <ClassDateBlock group={group} />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

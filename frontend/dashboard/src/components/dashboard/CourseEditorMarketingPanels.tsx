"use client";



import { useEffect, useMemo, useRef, useState } from "react";

import { CalendarDays, Plus, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";

import {

  Dialog,

  DialogContent,

  DialogFooter,

  DialogHeader,

  DialogTitle,

} from "@/components/ui/dialog";

import { toast } from "sonner";

import {

  useCourseClassSchedulesQuery,

  useCourseEditorDetailQuery,

  useCourseFaqsQuery,

  useCourseFaqMutations,

  useCourseScheduleMutations,

  usePatchCourseMarketingMutation,

  type ClassScheduleRow,

  type CourseFaqRow,

  type CourseHighlightInput,

} from "@/hooks/useCourseEditorQueries";
import { useDirtyForm } from "@/hooks/useDirtyForm";



type Props = {

  courseUuid: string;

  courseSlug: string;

  canEdit: boolean;

};



export function CourseWhyThisCoursePanel({ courseSlug, canEdit }: Omit<Props, "courseUuid">) {

  const { data } = useCourseEditorDetailQuery(courseSlug);

  const patchMutation = usePatchCourseMarketingMutation(courseSlug);

  const [title, setTitle] = useState("");

  const [highlights, setHighlights] = useState<CourseHighlightInput[]>([]);
  const [whyBaseline, setWhyBaseline] = useState<{ title: string; highlights: CourseHighlightInput[] } | null>(null);
  const hydratedFor = useRef<string | null>(null);



  useEffect(() => {

    hydratedFor.current = null;

  }, [courseSlug]);



  useEffect(() => {

    if (!data || hydratedFor.current === courseSlug) return;

    hydratedFor.current = courseSlug;

    const rows = Array.isArray(data.highlights) ? data.highlights : [];

    const mapped = rows.map((h) => ({

        heading: String(h.heading || h.title || "").trim(),

        description: String(h.description || h.body || "").trim(),

      }));

    setHighlights(mapped);
    const nextTitle = String(data.why_this_course_title || "").trim();
    setTitle(nextTitle);
    setWhyBaseline({ title: nextTitle, highlights: mapped });

  }, [data, courseSlug]);



  const busy = patchMutation.isPending;
  const whyDirty = useDirtyForm({ title, highlights }, whyBaseline, Boolean(whyBaseline));



  const save = async () => {

    const res = await patchMutation.mutateAsync({

      why_this_course_title: title.trim(),

      highlights: highlights.filter((h) => h.heading.trim() || h.description.trim()),

    });

    if (res.error) {

      toast.error(res.error);

      return;

    }

    toast.success("Why This Course saved");
    setWhyBaseline({ title: title.trim(), highlights });

  };

  return (

    <div className="space-y-4">

      <p className="text-sm text-muted-foreground">

        Shown on the public course page sidebar when title and highlights are set.

      </p>

      <div>

        <Label htmlFor="why-title">Section title</Label>

        <Input

          id="why-title"

          className="mt-1.5"

          value={title}

          onChange={(e) => setTitle(e.target.value)}

          disabled={!canEdit || busy}

          placeholder="Why MERN Stack?"

        />

      </div>

      <div className="space-y-3">

        <div className="flex items-center justify-between">

          <Label>Highlights</Label>

          {canEdit && (

            <Button

              type="button"

              size="sm"

              variant="outline"

              onClick={() => setHighlights((prev) => [...prev, { heading: "", description: "" }])}

              disabled={busy}

            >

              <Plus className="mr-1 h-3.5 w-3.5" /> Add highlight

            </Button>

          )}

        </div>

        {highlights.length === 0 ? (

          <p className="text-sm text-muted-foreground">No highlights yet.</p>

        ) : (

          highlights.map((h, i) => (

            <div key={i} className="space-y-2 rounded-lg border border-border p-3">

              <Input

                value={h.heading}

                onChange={(e) =>

                  setHighlights((prev) =>

                    prev.map((row, j) => (j === i ? { ...row, heading: e.target.value } : row)),

                  )

                }

                disabled={!canEdit || busy}

                placeholder="Heading"

              />

              <Textarea

                value={h.description}

                onChange={(e) =>

                  setHighlights((prev) =>

                    prev.map((row, j) => (j === i ? { ...row, description: e.target.value } : row)),

                  )

                }

                disabled={!canEdit || busy}

                placeholder="Description"

                rows={2}

              />

              {canEdit && (

                <Button

                  type="button"

                  size="sm"

                  variant="ghost"

                  className="text-destructive"

                  onClick={() => setHighlights((prev) => prev.filter((_, j) => j !== i))}

                  disabled={busy}

                >

                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove

                </Button>

              )}

            </div>

          ))

        )}

      </div>

      {canEdit && (

        <Button className="btn-highlight" disabled={busy || !whyDirty} onClick={() => void save()}>

          Save Why This Course

        </Button>

      )}

    </div>

  );

}



export function CourseFaqsPanel({ courseUuid, canEdit }: Omit<Props, "courseSlug">) {

  const { data: rows = [] } = useCourseFaqsQuery(courseUuid);

  const { create, update, remove } = useCourseFaqMutations(courseUuid);

  const [dialogOpen, setDialogOpen] = useState(false);

  const [editing, setEditing] = useState<CourseFaqRow | null>(null);

  const [question, setQuestion] = useState("");

  const [answer, setAnswer] = useState("");



  const busy = create.isPending || update.isPending || remove.isPending;



  const openAdd = () => {

    setEditing(null);

    setQuestion("");

    setAnswer("");

    setDialogOpen(true);

  };



  const openEdit = (row: CourseFaqRow) => {

    setEditing(row);

    setQuestion(row.question);

    setAnswer(row.answer);

    setDialogOpen(true);

  };



  const save = async () => {

    if (!question.trim() || !answer.trim()) {

      toast.error("Question and answer are required");

      return;

    }

    if (editing) {

      const res = await update.mutateAsync({

        id: editing.id,

        payload: { question: question.trim(), answer: answer.trim() },

      });

      if (res.error) {

        toast.error(res.error);

        return;

      }

      toast.success("FAQ updated");

    } else {

      const res = await create.mutateAsync({

        question: question.trim(),

        answer: answer.trim(),

        order: rows.length,

      });

      if (res.error) {

        toast.error(res.error);

        return;

      }

      toast.success("FAQ created");

    }

    setDialogOpen(false);

  };



  const onRemove = async (row: CourseFaqRow) => {

    if (!confirm("Delete this FAQ?")) return;

    const res = await remove.mutateAsync(row.id);

    if (res.error) {

      toast.error(res.error);

      return;

    }

    toast.success("FAQ deleted");

  };



  return (

    <div className="space-y-4">

      <div className="flex items-center justify-between">

        <p className="text-sm text-muted-foreground">

          Course-specific FAQs appear above the site footer on the public course page.

        </p>

        {canEdit && (

          <Button type="button" size="sm" className="btn-highlight shrink-0" onClick={openAdd} disabled={busy}>

            <Plus className="mr-1 h-4 w-4" /> Add FAQ

          </Button>

        )}

      </div>

      {rows.length === 0 ? (

        <p className="text-sm text-muted-foreground">No FAQs for this course yet.</p>

      ) : (

        <ul className="divide-y divide-border rounded-lg border border-border">

          {rows.map((row) => (

            <li key={row.id} className="flex gap-3 p-4">

              <div className="min-w-0 flex-1">

                <p className="font-semibold">{row.question}</p>

                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.answer}</p>

              </div>

              {canEdit && (

                <div className="flex shrink-0 gap-1">

                  <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(row)} disabled={busy}>

                    <Pencil className="h-4 w-4" />

                  </Button>

                  <Button

                    type="button"

                    size="icon"

                    variant="ghost"

                    className="text-destructive"

                    onClick={() => void onRemove(row)}

                    disabled={busy}

                  >

                    <Trash2 className="h-4 w-4" />

                  </Button>

                </div>

              )}

            </li>

          ))}

        </ul>

      )}



      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>

        <DialogContent>

          <DialogHeader>

            <DialogTitle>{editing ? "Edit FAQ" : "Add FAQ"}</DialogTitle>

          </DialogHeader>

          <div className="space-y-3">

            <div>

              <Label>Question</Label>

              <Input className="mt-1.5" value={question} onChange={(e) => setQuestion(e.target.value)} />

            </div>

            <div>

              <Label>Answer</Label>

              <Textarea className="mt-1.5" rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} />

            </div>

          </div>

          <DialogFooter>

            <Button variant="outline" onClick={() => setDialogOpen(false)}>

              Cancel

            </Button>

            <Button className="btn-highlight" disabled={busy} onClick={() => void save()}>

              Save

            </Button>

          </DialogFooter>

        </DialogContent>

      </Dialog>

    </div>

  );

}



function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (value == null || value === "") continue;
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const nested = firstString(
        obj.start_time,
        obj.startTime,
        obj.end_time,
        obj.endTime,
        obj.start,
        obj.end,
        obj.hour,
        obj.hours,
      );
      if (nested) return nested;
      continue;
    }
    const text = String(value).trim();
    if (text && text !== "null" && text !== "undefined") return text;
  }
  return "";
}

function readRow(row: ClassScheduleRow): Record<string, unknown> {
  return row as unknown as Record<string, unknown>;
}

/** Normalize API date (`YYYY-MM-DD` or ISO datetime) to a calendar day. */
function parseScheduleDate(raw: string): Date | null {
  const text = raw.trim();
  if (!text) return null;
  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Accept `HH:MM:SS` (API `start_time` / `end_time`) and return `05:00 PM`. */
function formatHmsTo12Hour(raw: unknown): string {
  if (raw == null || raw === "") return "";
  const text = String(raw).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!match) return "";
  const hours24 = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours24) || !Number.isFinite(minutes)) return "";
  const meridiem = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${String(hours12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

/** Time line only — reads API `start_time` / `end_time` (`HH:MM:SS`). */
function formatScheduleTimeRange(row: ClassScheduleRow): string {
  const startLabel = formatHmsTo12Hour(row.start_time);
  const endLabel = formatHmsTo12Hour(row.end_time);
  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
  return startLabel;
}

function formatScheduleEntry(row: ClassScheduleRow): { dateLabel: string } {
  const r = readRow(row);
  const dateRaw = firstString(
    r.date,
    r.class_date,
    r.classDate,
    r.scheduled_date,
    r.scheduledDate,
    r.start_datetime,
    r.startDatetime,
  );

  const date = parseScheduleDate(dateRaw);
  const dateLabel = date
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : dateRaw;

  return { dateLabel };
}

function scheduleRowId(row: ClassScheduleRow): string {
  const r = readRow(row);
  const raw = row.id ?? r.uuid ?? r.pk;
  if (raw == null || raw === "") return "";
  return String(raw);
}

/** HTML `type="time"` uses `HH:MM`; API stores `HH:MM:SS`. */
function toApiTime(raw: string): string {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return raw.trim();
  return `${match[1].padStart(2, "0")}:${match[2]}:${match[3] ?? "00"}`;
}

function toInputTime(raw: string): string {
  const iso = raw.match(/T(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}`;
  const clock = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!clock) return "";
  return `${clock[1].padStart(2, "0")}:${clock[2]}`;
}

function groupScheduleRows(rows: ClassScheduleRow[]): Array<{
  dateKey: string;
  dateLabel: string;
  slots: ClassScheduleRow[];
}> {
  const groups: Array<{ dateKey: string; dateLabel: string; slots: ClassScheduleRow[] }> = [];
  for (const row of rows) {
    const dateKey = firstString(row.date, row.class_date, row.scheduled_date).slice(0, 10);
    const { dateLabel } = formatScheduleEntry(row);
    const last = groups[groups.length - 1];
    if (last && last.dateKey === dateKey && dateKey) {
      last.slots.push(row);
    } else {
      groups.push({
        dateKey: dateKey || `ungrouped-${groups.length}`,
        dateLabel,
        slots: [row],
      });
    }
  }
  return groups;
}

export function CourseClassSchedulesPanel({ courseUuid, canEdit }: Omit<Props, "courseSlug">) {

  const { data: rows = [] } = useCourseClassSchedulesQuery(courseUuid);
  const dateGroups = useMemo(() => groupScheduleRows(rows), [rows]);

  const { create, update, remove } = useCourseScheduleMutations(courseUuid);

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [dateError, setDateError] = useState<string>("");
  const [startTimeError, setStartTimeError] = useState<string>("");
  const [endTimeError, setEndTimeError] = useState<string>("");
  const formRef = useRef<HTMLDivElement>(null);
  const [scheduleBaseline, setScheduleBaseline] = useState<{ date: string; startTime: string; endTime: string } | null>(null);

  const busy = create.isPending || update.isPending || remove.isPending;
  const scheduleDirty = useDirtyForm(
    { date, startTime, endTime },
    scheduleBaseline,
    Boolean(editingId),
  );



  const resetForm = () => {
    setEditingId(null);
    setDate("");
    setStartTime("");
    setEndTime("");
    setScheduleBaseline(null);
    setDateError("");
    setStartTimeError("");
    setEndTimeError("");
  };

  const validate = () => {
    const d = date.trim();
    const st = startTime.trim();
    const et = endTime.trim();

    let ok = true;

    if (!d) {
      setDateError("Date is required");
      ok = false;
    } else setDateError("");

    if (!st) {
      setStartTimeError("Start time is required");
      ok = false;
    } else setStartTimeError("");

    if (et) {
      const parse = (v: string) => {
        const m = v.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (!m) return null;
        const hh = Number(m[1]);
        const mm = Number(m[2]);
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
        return hh * 60 + mm;
      };

      const stMin = parse(st);
      const etMin = parse(et);

      if (stMin == null || etMin == null) {
        setEndTimeError("Invalid time format");
        ok = false;
      } else if (etMin <= stMin) {
        setEndTimeError("End time must be after start time");
        ok = false;
      } else {
        setEndTimeError("");
      }
    } else {
      setEndTimeError("");
    }

    return ok;
  };

  const onSubmit = async () => {
    if (!validate()) return;

    const payload = {
      date: date.trim(),
      start_time: toApiTime(startTime),
      end_time: endTime.trim() ? toApiTime(endTime) : null,
    };

    if (editingId) {
      const res = await update.mutateAsync({ scheduleId: editingId, payload });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Class schedule updated");
      resetForm();
      return;
    }

    const res = await create.mutateAsync({
      date: payload.date,
      start_time: payload.start_time,
      ...(payload.end_time ? { end_time: payload.end_time } : {}),
    });
    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success("Class schedule added");
    resetForm();
  };

  const onRemove = async (row: ClassScheduleRow) => {
    const id = scheduleRowId(row);
    if (!id || !confirm("Delete this upcoming class?")) return;

    const res = await remove.mutateAsync(id);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success("Class schedule deleted");

    if (editingId && id === editingId) resetForm();
  };

  const onEdit = (row: ClassScheduleRow) => {
    const id = scheduleRowId(row);
    if (!id) {
      toast.error("This class is missing an id and cannot be edited");
      return;
    }

    const dateKey = firstString(row.date, row.class_date, row.scheduled_date, row.start_datetime).slice(0, 10);

    setEditingId(id);
    setDate(dateKey);
    const st = toInputTime(firstString(row.start_time, row.start, row.start_datetime));
    const et = toInputTime(firstString(row.end_time, row.end, row.end_datetime));
    setStartTime(st);
    setEndTime(et);
    setScheduleBaseline({ date: dateKey, startTime: st, endTime: et });
    setDateError("");
    setStartTimeError("");
    setEndTimeError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (

    <div className="space-y-4">

      <p className="text-sm text-muted-foreground">

        Powers the Upcoming Classes card on the public course page.

      </p>

      {canEdit && (

        <div ref={formRef} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">

          <div>

            <Label htmlFor="sched-date">Date</Label>

            <Input

              id="sched-date"

              type="date"

              className="mt-1.5"

              value={date}

              onChange={(e) => setDate(e.target.value)}

              disabled={busy}

            />

            {dateError ? <p className="mt-1 text-xs text-destructive">{dateError}</p> : null}

          </div>

          <div>

            <Label htmlFor="sched-start-time">Start Time</Label>

            <Input

              id="sched-start-time"

              type="time"

              className="mt-1.5"

              value={startTime}

              onChange={(e) => setStartTime(e.target.value)}

              disabled={busy}

            />

            {startTimeError ? <p className="mt-1 text-xs text-destructive">{startTimeError}</p> : null}

          </div>

          <div className="sm:col-span-2">

            <Label htmlFor="sched-end">End Time (optional)</Label>

            <Input

              id="sched-end"

              type="time"

              className="mt-1.5"

              value={endTime}

              onChange={(e) => setEndTime(e.target.value)}

              disabled={busy}

            />

            {endTimeError ? <p className="mt-1 text-xs text-destructive">{endTimeError}</p> : null}

          </div>

          <div className="sm:col-span-2">

            <div className="flex flex-wrap gap-2">

              <Button
                type="button"
                className="btn-highlight"
                disabled={busy || Boolean(editingId && !scheduleDirty)}
                onClick={() => void onSubmit()}
              >

                <Plus className="mr-1 h-4 w-4" />{" "}
                {editingId ? "Update upcoming class" : "Add upcoming class"}

              </Button>

              {editingId ? (

                <Button type="button" variant="outline" disabled={busy} onClick={resetForm}>

                  Cancel

                </Button>

              ) : null}

            </div>

          </div>

        </div>

      )}

      {rows.length === 0 ? (

        <p className="text-sm text-muted-foreground">No upcoming classes scheduled.</p>

      ) : (

        <ul className="space-y-2">

          {dateGroups.map((group) => (
            <li key={group.dateKey} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0 text-[#181818]" aria-hidden />
                <span className="text-sm font-bold text-[#181818]">{group.dateLabel || "Untitled class"}</span>
              </div>
              <ul className="mt-0.5 space-y-1">
                {group.slots.map((slot, i) => {
                  const timeLabel = formatScheduleTimeRange(slot);
                  const rowId = scheduleRowId(slot);
                  const isEditing = Boolean(rowId && editingId === rowId);
                  return (
                    <li
                      key={rowId || `${group.dateKey}-${i}`}
                      className={`flex items-start justify-between gap-3 pl-6 ${
                        isEditing ? "rounded-md ring-1 ring-primary" : ""
                      }`}
                    >
                      <p className="text-sm text-muted-foreground">
                        {timeLabel || "Time not set"}
                      </p>
                      {canEdit && rowId ? (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label="Edit upcoming class"
                            onClick={() => onEdit(slot)}
                            disabled={busy}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            aria-label="Delete upcoming class"
                            onClick={() => void onRemove(slot)}
                            disabled={busy}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}

        </ul>

      )}

    </div>

  );

}


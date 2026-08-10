import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/dashboard/DashboardLayout";
import { useDashboardData } from "@/components/dashboard/DashboardDataContext";
import { useAuth } from "@/components/dashboard/AuthContext";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useMemo, useState } from "react";
import { getAccessToken } from "@/lib/api";
import { ProtectedIframe, ProtectedVideo } from "@/components/dashboard/ContentProtection";
import { contentApi } from "@/lib/content-api";
import { toast } from "sonner";
import type { Course } from "@/lib/mock";

export const Route = createFileRoute("/dashboard/course-content/$slug")({
  component: CourseContentPage,
});

type CoursePart = Course["chapters"][number]["parts"][number];

function embedVideoUrl(url: string): string | null {
  const trimmed = (url || "").trim();
  if (!trimmed) return null;
  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/i);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?modestbranding=1&rel=0`;
  return trimmed;
}

function PartContentPanel({ part }: { part: CoursePart }) {
  if (part.type === "video") {
    const embed = embedVideoUrl(part.videoUrl || "");
    return (
      <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
        {embed ? (
          embed.includes("youtube.com/embed") ? (
            <ProtectedIframe src={embed} title={part.title} />
          ) : (
            <ProtectedVideo src={embed} title={part.title} accessToken={getAccessToken()} />
          )
        ) : (
          <p className="text-sm text-muted-foreground">No video URL available for this part.</p>
        )}
        {(part.description || part.notes) && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {part.description || part.notes}
          </p>
        )}
      </div>
    );
  }

  const body = part.notes || part.description || "";
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
      {body ? (
        <div className="prose prose-sm max-w-none text-sm whitespace-pre-wrap text-foreground">
          {body}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {part.type === "pdf"
            ? "No PDF notes uploaded for this part."
            : "No notes available for this part."}
        </p>
      )}
      {part.type === "pdf" && part.videoUrl && (
        <a
          href={part.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open PDF <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function CourseContentPage() {
  const { slug } = Route.useParams();
  const { isAdmin, isTeacher, isStudent } = useAuth();
  const { courses, updateCourseLocal } = useDashboardData();
  const navigate = useNavigate();

  const canEditContent = (isAdmin || isTeacher) && !isStudent;

  const course = useMemo(() => courses.find((c: any) => c.slug === slug), [courses, slug]);

  const [expandedPart, setExpandedPart] = useState<string | null>(null);
  const [chapterTitle, setChapterTitle] = useState("");
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [addPartChapterIdx, setAddPartChapterIdx] = useState(-1);
  const [addPartForm, setAddPartForm] = useState({
    title: "",
  });
  const [contentBusy, setContentBusy] = useState(false);

  const [editChapterOpen, setEditChapterOpen] = useState(false);
  const [editChapterIdx, setEditChapterIdx] = useState(-1);
  const [editChapterTitle, setEditChapterTitle] = useState("");

  const [editPartOpen, setEditPartOpen] = useState(false);
  const [editPartChapterIdx, setEditPartChapterIdx] = useState(-1);
  const [editPartIdx, setEditPartIdx] = useState(-1);
  const [editPartForm, setEditPartForm] = useState({
    title: "",
  });

  if (!course) return <div className="p-6">Course not found.</div>;

  const syncChapters = (chapters: Course["chapters"]) => {
    updateCourseLocal(course.slug, { chapters });
  };

  const addChapter = async () => {
    if (!chapterTitle.trim()) return;
    const title = chapterTitle.trim();
    if (!(course as any)._uuid) {
      toast.error("Course is missing a backend id — refresh and try again");
      return;
    }
    setContentBusy(true);
    const res = await contentApi.createChapter({
      course: (course as any)._uuid,
      title,
      order: course.chapters.length,
      is_published: true,
    });
    setContentBusy(false);
    if (!res.ok || !res.data) {
      toast.error(res.detail || "Could not add chapter");
      return;
    }
    syncChapters([...course.chapters, { id: String(res.data.id), title, parts: [] }]);
    setChapterTitle("");
    toast.success("Chapter added");
  };

  const addPart = async () => {
    const chapterIdx = addPartChapterIdx;
    const title = addPartForm.title.trim();
    if (!title) {
      toast.error("Enter a part title");
      return;
    }
    const chapter = course.chapters[chapterIdx];
    if (!chapter?.id) {
      toast.error("Chapter is missing a backend id — refresh and try again");
      return;
    }
    setContentBusy(true);
    const res = await contentApi.createPart({
      chapter: chapter.id,
      title,
      type: "video",
      order: chapter.parts.length,
      is_published: true,
    });
    setContentBusy(false);
    if (!res.ok || !res.data) {
      toast.error(res.detail || "Could not add part");
      return;
    }
    const chapters = course.chapters.map((ch, i) =>
      i === chapterIdx
        ? {
            ...ch,
            parts: [
              ...ch.parts,
              {
                id: String(res.data!.id),
                title,
                type: "video" as const,
                duration: "",
                videoUrl: "",
                notes: "",
                description: "",
              },
            ],
          }
        : ch,
    );
    syncChapters(chapters);
    setAddPartOpen(false);
    setAddPartForm({ title: "" });
    toast.success("Part added");
  };

  const openEditChapter = (idx: number) => {
    setEditChapterIdx(idx);
    setEditChapterTitle(course.chapters[idx]?.title || "");
    setEditChapterOpen(true);
  };

  const saveEditChapter = async () => {
    if (editChapterIdx < 0) return;
    const ch = course.chapters[editChapterIdx];
    const title = editChapterTitle.trim();
    if (!title) {
      toast.error("Chapter title is required");
      return;
    }
    if (!ch?.id) {
      toast.error("Chapter is missing a backend id");
      return;
    }
    setContentBusy(true);
    const res = await contentApi.updateChapter(ch.id, { title });
    setContentBusy(false);
    if (!res.ok) {
      toast.error(res.detail || "Could not update chapter");
      return;
    }
    syncChapters(course.chapters.map((c, i) => (i === editChapterIdx ? { ...c, title } : c)));
    setEditChapterOpen(false);
    toast.success("Chapter updated");
  };

  const deleteChapter = async (idx: number) => {
    const ch = course.chapters[idx];
    if (!ch?.id) {
      toast.error("Chapter is missing a backend id");
      return;
    }
    if (!confirm(`Delete chapter "${ch.title}" and all its parts?`)) return;
    setContentBusy(true);
    const res = await contentApi.deleteChapter(ch.id);
    setContentBusy(false);
    if (!res.ok) {
      toast.error(res.detail || "Could not delete chapter");
      return;
    }
    syncChapters(course.chapters.filter((_, i) => i !== idx));
    toast.success("Chapter deleted");
  };

  const openEditPart = (chapterIdx: number, partIdx: number) => {
    const p = course.chapters[chapterIdx]?.parts[partIdx];
    if (!p) return;
    setEditPartChapterIdx(chapterIdx);
    setEditPartIdx(partIdx);
    setEditPartForm({
      title: p.title,
    });
    setEditPartOpen(true);
  };

  const saveEditPart = async () => {
    if (editPartChapterIdx < 0 || editPartIdx < 0) return;
    const p = course.chapters[editPartChapterIdx]?.parts[editPartIdx];
    const title = editPartForm.title.trim();
    if (!title) {
      toast.error("Part title is required");
      return;
    }
    if (!p?.id) {
      toast.error("Part is missing a backend id");
      return;
    }
    setContentBusy(true);
    const res = await contentApi.updatePart(p.id, {
      title,
    });
    setContentBusy(false);
    if (!res.ok) {
      toast.error(res.detail || "Could not update part");
      return;
    }
    const chapters = course.chapters.map((ch, i) =>
      i === editPartChapterIdx
        ? {
            ...ch,
            parts: ch.parts.map((part, j) =>
              j === editPartIdx
                ? {
                    ...part,
                    title,
                  }
                : part,
            ),
          }
        : ch,
    );
    syncChapters(chapters);
    setEditPartOpen(false);
    toast.success("Part updated");
  };

  const deletePart = async (chapterIdx: number, partIdx: number) => {
    const p = course.chapters[chapterIdx]?.parts[partIdx];
    if (!p?.id) {
      toast.error("Part is missing a backend id");
      return;
    }
    if (!confirm(`Delete part "${p.title}"?`)) return;
    setContentBusy(true);
    const res = await contentApi.deletePart(p.id);
    setContentBusy(false);
    if (!res.ok) {
      toast.error(res.detail || "Could not delete part");
      return;
    }
    syncChapters(
      course.chapters.map((ch, i) =>
        i === chapterIdx ? { ...ch, parts: ch.parts.filter((_, j) => j !== partIdx) } : ch,
      ),
    );
    toast.success("Part deleted");
  };

  return (
    <div className="p-6">
      <PageHeader
        title={`${course.title} — Content`}
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard/courses" })}>
            Back
          </Button>
        }
      />
      <Card className="mt-4">
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {course.chapters.length} chapters •{" "}
            {course.chapters.reduce((n: number, ch: any) => n + ch.parts.length, 0)} parts
          </p>
          <Accordion type="multiple" className="mt-2">
            {course.chapters.map((ch: any, i: number) => (
              <AccordionItem
                key={ch.id || i}
                value={`c${i}`}
                className="rounded-lg border border-border bg-card px-4 mb-2"
              >
                <div className="flex items-center gap-2">
                  <AccordionTrigger className="flex-1 text-left font-semibold hover:no-underline">
                    Chapter {i + 1} — {ch.title}
                  </AccordionTrigger>
                  {canEditContent && (
                    <div className="flex shrink-0 gap-1 pr-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEditChapter(i)}
                        disabled={contentBusy}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => void deleteChapter(i)}
                        disabled={contentBusy}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <AccordionContent>
                  <ul className="divide-y divide-border">
                    {ch.parts.map((p: any, j: number) => {
                      const partKey = `${i}-${j}`;
                      const expanded = expandedPart === partKey;
                      return (
                        <li key={p.id || j} className="py-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-center justify-between text-left text-sm hover:text-primary"
                              onClick={() => setExpandedPart(expanded ? null : partKey)}
                            >
                              <span>{p.title}</span>
                              <ChevronRight
                                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                                  expanded ? "rotate-90" : ""
                                }`}
                              />
                            </button>
                            {canEditContent && (
                              <div className="flex shrink-0 gap-0.5">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => openEditPart(i, j)}
                                  disabled={contentBusy}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => void deletePart(i, j)}
                                  disabled={contentBusy}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                          {expanded && <PartContentPanel part={p} />}
                        </li>
                      );
                    })}
                  </ul>
                  {canEditContent && (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={contentBusy}
                        onClick={() => {
                          setAddPartChapterIdx(i);
                          setAddPartForm({ title: "" });
                          setAddPartOpen(true);
                        }}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add part
                      </Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          {canEditContent && (
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="New chapter title"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
              />
              <Button
                size="sm"
                className="btn-highlight"
                disabled={contentBusy}
                onClick={() => void addChapter()}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add chapter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editChapterOpen} onOpenChange={setEditChapterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit chapter</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Title</Label>
            <Input
              className="mt-1.5"
              value={editChapterTitle}
              onChange={(e) => setEditChapterTitle(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditChapterOpen(false)}>
              Cancel
            </Button>
            <Button className="btn-highlight" disabled={contentBusy} onClick={() => void saveEditChapter()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addPartOpen} onOpenChange={setAddPartOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add part</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Title</Label>
              <Input
                className="mt-1.5"
                value={addPartForm.title}
                onChange={(e) => setAddPartForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            {/*
              <div>
                <Label>Video URL</Label>
                <Input
                  className="mt-1.5"
                  value=""
                  onChange={() => undefined}
                  placeholder="https://â€¦"
                />
              </div>
            */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPartOpen(false)}>
              Cancel
            </Button>
            <Button className="btn-highlight" disabled={contentBusy} onClick={() => void addPart()}>
              Add part
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editPartOpen} onOpenChange={setEditPartOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit part</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Title</Label>
              <Input
                className="mt-1.5"
                value={editPartForm.title}
                onChange={(e) => setEditPartForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            {/*
              <div>
                <Label>Video URL</Label>
                <Input
                  className="mt-1.5"
                  value=""
                  onChange={() => undefined}
                  placeholder="https://…"
                />
              </div>
            */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPartOpen(false)}>
              Cancel
            </Button>
            <Button className="btn-highlight" disabled={contentBusy} onClick={() => void saveEditPart()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

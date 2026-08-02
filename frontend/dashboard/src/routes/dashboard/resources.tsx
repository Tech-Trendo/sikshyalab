import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { useDashboardData } from "@/components/dashboard/DashboardDataContext";
import { useTeacherScope } from "@/components/dashboard/useTeacherScope";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderOpen, Upload, Trash2, FileText, PlayCircle, StickyNote, Paperclip } from "lucide-react";
import { paginate } from "@/lib/dashboard-utils";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/resources")({
  component: ResourcesPage,
});

const typeIcon = {
  video: PlayCircle,
  notes: StickyNote,
  pdf: FileText,
  other: Paperclip,
} as const;

function ResourcesPage() {
  const { partResources, addPartResource, removePartResource } = useDashboardData();
  const { isTeacher, myCourses } = useTeacherScope();
  const fileRef = useRef<HTMLInputElement>(null);
  const [courseSlug, setCourseSlug] = useState("");
  const [chapterIndex, setChapterIndex] = useState(0);
  const [partIndex, setPartIndex] = useState(0);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"video" | "notes" | "pdf" | "other">("pdf");
  const [page, setPage] = useState(1);

  const course = myCourses.find((c) => c.slug === courseSlug) || myCourses[0];
  const activeSlug = course?.slug || "";
  const chapters = course?.chapters || [];
  const parts = chapters[chapterIndex]?.parts || [];

  const scoped = useMemo(
    () => partResources.filter((r) => myCourses.some((c) => c.slug === r.courseSlug)),
    [partResources, myCourses],
  );
  const paged = paginate(scoped, page);

  const onUpload = () => {
    if (!course) {
      toast.error("No course available");
      return;
    }
    if (!chapters.length) {
      toast.error("Selected course has no chapters");
      return;
    }
    if (!parts.length) {
      toast.error("Selected chapter has no parts");
      return;
    }
    if (!title.trim()) {
      toast.error("Enter a resource title");
      return;
    }
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a file to upload");
      return;
    }
    addPartResource({
      courseSlug: course.slug,
      chapterIndex,
      partIndex,
      title: title.trim(),
      type,
      fileName: file.name,
    });
    toast.success(`Uploaded ${file.name}`, {
      description: `${course.title} → ${chapters[chapterIndex].title} → ${parts[partIndex].title}`,
    });
    setTitle("");
    if (fileRef.current) fileRef.current.value = "";
  };

  if (!isTeacher) {
    return (
      <>
        <PageHeader title="Resources" subtitle="Course resources are managed from the teacher portal." />
        <Card className="border-border/60">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Switch to a teacher account to upload videos, notes, PDFs and other resources for course chapters and parts.
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Resources"
        subtitle="Upload videos, notes, PDFs and files to a course → chapter → part."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="My courses" value={myCourses.length} icon={FolderOpen} tone="primary" />
        <StatCard label="Uploaded resources" value={scoped.length} icon={Upload} tone="info" />
        <StatCard label="PDFs" value={scoped.filter((r) => r.type === "pdf").length} icon={FileText} tone="success" />
      </div>

      <Card className="mt-6 border-border/60">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <Label>Course</Label>
            <Select
              value={activeSlug}
              onValueChange={(v) => {
                setCourseSlug(v);
                setChapterIndex(0);
                setPartIndex(0);
              }}
            >
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                {myCourses.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Chapter</Label>
            <Select
              value={String(chapterIndex)}
              onValueChange={(v) => {
                setChapterIndex(Number(v));
                setPartIndex(0);
              }}
            >
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select chapter" /></SelectTrigger>
              <SelectContent>
                {chapters.map((ch, i) => (
                  <SelectItem key={i} value={String(i)}>Chapter {i + 1} — {ch.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Part</Label>
            <Select value={String(partIndex)} onValueChange={(v) => setPartIndex(Number(v))}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select part" /></SelectTrigger>
              <SelectContent>
                {parts.map((p, i) => (
                  <SelectItem key={i} value={String(i)}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="notes">Notes</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Title</Label>
            <Input className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week 1 lecture notes" />
          </div>
          <div className="sm:col-span-2">
            <Label>File</Label>
            <Input ref={fileRef} className="mt-1.5" type="file" accept="video/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.md,image/*" />
          </div>
          <div className="sm:col-span-2">
            <Button className="btn-highlight" onClick={onUpload}>
              <Upload className="mr-1 h-4 w-4" /> Upload resource
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/60">
        <CardContent className="space-y-3 p-5">
          <p className="text-sm font-semibold">Uploaded resources</p>
          {paged.items.map((r) => {
            const c = myCourses.find((x) => x.slug === r.courseSlug);
            const ch = c?.chapters[r.chapterIndex];
            const part = ch?.parts[r.partIndex];
            const Icon = typeIcon[r.type];
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c?.title} → {ch?.title || "—"} → {part?.title || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.fileName} · {new Date(r.uploadedAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{r.type}</Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { removePartResource(r.id); toast.success("Resource removed"); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {scoped.length === 0 && <p className="text-sm text-muted-foreground">No resources uploaded yet.</p>}
          <DataPagination page={paged.page} totalPages={paged.totalPages} total={paged.total} from={paged.from} to={paged.to} onPageChange={setPage} />
        </CardContent>
      </Card>
    </>
  );
}

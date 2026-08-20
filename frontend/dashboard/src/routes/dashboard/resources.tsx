import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import {
  useDashboardData,
  type PartResourceItem,
} from "@/components/dashboard/DashboardDataContext";
import { useTeacherScope } from "@/components/dashboard/useTeacherScope";
import { useStudentScope } from "@/components/dashboard/useStudentScope";
import { useAuth } from "@/components/dashboard/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderOpen,
  Upload,
  Trash2,
  FileText,
  PlayCircle,
  StickyNote,
  Paperclip,
  Image as ImageIcon,
} from "lucide-react";
import { paginate } from "@/lib/dashboard-utils";
import { dashboardPathForRole } from "@/lib/auth-routes";
import { normalizeSecureMediaKind } from "@/lib/signed-media";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SecureMedia } from "@/components/dashboard/SecureMedia";
import { requirePermission } from "@/lib/permission-guards";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/dashboard/resources")({
  beforeLoad: requirePermission("content.view"),
  component: ResourcesPage,
});

const typeIcon = {
  video: PlayCircle,
  notes: StickyNote,
  pdf: FileText,
  other: Paperclip,
  image: ImageIcon,
} as const;

function resourceKind(r: PartResourceItem) {
  return normalizeSecureMediaKind(r.type, {
    fileName: r.fileName,
    fileUrl: r.fileUrl,
    fallback: "other",
  });
}

function ResourceOpenPanel({ resource }: { resource: PartResourceItem }) {
  return (
    <div className="mt-2 max-w-xl">
      <SecureMedia
        resourceId={resource.id}
        type={resourceKind(resource)}
        title={resource.title}
        fileName={resource.fileName}
        nestedTimestamps={resource.timestamps}
      />
    </div>
  );
}

function ResourcesPage() {
  const { isTeacher, isStudent, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const { partResources, addPartResource, removePartResource, courses } = useDashboardData();
  const { myCourses: teacherCourses } = useTeacherScope();
  const { myCourses: studentCourses } = useStudentScope();
  const { hasPermission, loading: permsLoading } = usePermissions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [courseSlug, setCourseSlug] = useState("");
  const [chapterIndex, setChapterIndex] = useState(0);
  const [partIndex, setPartIndex] = useState(0);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"video" | "notes" | "pdf" | "other">("pdf");
  const [page, setPage] = useState(1);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const canUpload = isAdmin || (isTeacher && !permsLoading && hasPermission("content.upload_resources"));
  // Admin: every course. Teacher: assigned courses. Student: enrolled courses.
  const visibleCourses = isAdmin
    ? courses
    : isTeacher
      ? teacherCourses
      : studentCourses;

  const course = visibleCourses.find((c) => c.slug === courseSlug) || visibleCourses[0];
  const activeSlug = course?.slug || "";
  const chapters = course?.chapters || [];
  const parts = chapters[chapterIndex]?.parts || [];

  const scoped = useMemo(
    () =>
      isAdmin
        ? partResources
        : partResources.filter((r) => visibleCourses.some((c) => c.slug === r.courseSlug)),
    [isAdmin, partResources, visibleCourses],
  );
  const paged = paginate(scoped, page);

  const onUpload = async () => {
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
    const part = parts[partIndex];
    if (!part?.id) {
      toast.error("The selected part is not synced with the backend yet");
      return;
    }
    try {
      const result = await addPartResource({
        courseSlug: course.slug,
        chapterIndex,
        partIndex,
        partId: String(part.id),
        title: title.trim(),
        type,
        file,
      });
      if (!result.ok) {
        toast.error("Upload failed", { description: result.detail });
        return;
      }
      toast.success(`Uploaded ${file.name}`, {
        description: `${course.title} → ${chapters[chapterIndex].title} → ${parts[partIndex].title}`,
      });
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      const dest = dashboardPathForRole(user.role);
      await navigate({ to: dest });
    } catch (err) {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "Unexpected error after upload",
      });
    }
  };

  return (
    <>
      <PageHeader
        title="Resources"
        subtitle={
          isAdmin
            ? "Upload and manage resources for any course → chapter → part."
            : canUpload
              ? "Upload videos, notes, PDFs and files to a course → chapter → part."
              : "Resources for courses you are enrolled in."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={isAdmin ? "All courses" : canUpload ? "My courses" : "Enrolled courses"}
          value={visibleCourses.length}
          icon={FolderOpen}
          tone="primary"
        />
        <StatCard label="Resources" value={scoped.length} icon={Upload} tone="info" />
        <StatCard
          label="Videos"
          value={scoped.filter((r) => resourceKind(r) === "video").length}
          icon={PlayCircle}
          tone="highlight"
        />
        <StatCard
          label="PDFs"
          value={scoped.filter((r) => resourceKind(r) === "pdf").length}
          icon={FileText}
          tone="success"
        />
      </div>

      {canUpload && (
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
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {visibleCourses.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.title}
                    </SelectItem>
                  ))}
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
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select chapter" />
                </SelectTrigger>
                <SelectContent>
                  {chapters.map((ch, i) => (
                    <SelectItem key={i} value={String(i)}>
                      Chapter {i + 1} — {ch.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="notes">Notes</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                className="mt-1.5"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Resource title"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>File</Label>
              <Input className="mt-1.5" type="file" ref={fileRef} />
            </div>
            <div className="sm:col-span-2">
              <Button className="btn-highlight" onClick={() => void onUpload()}>
                <Upload className="mr-2 h-4 w-4" /> Upload resource
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6 border-border/60">
        <CardContent className="space-y-3 p-5">
          {paged.items.map((r) => {
            const c =
              courses.find((courseRow) => courseRow.slug === r.courseSlug) ||
              visibleCourses.find((courseRow) => courseRow.slug === r.courseSlug);
            const ch = c?.chapters[r.chapterIndex];
            const part = ch?.parts[r.partIndex];
            const kind = resourceKind(r);
            const Icon = typeIcon[kind] || Paperclip;
            const open = previewId === r.id;
            return (
              <div
                key={r.id}
                className="rounded-lg border border-border/60 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c?.title} → {ch?.title || "—"} → {part?.title || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.fileName} · {new Date(r.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="btn-highlight"
                      onClick={() => setPreviewId(open ? null : r.id)}
                    >
                      {open
                        ? "Hide"
                        : kind === "pdf"
                          ? "Open PDF"
                          : kind === "video"
                            ? "Play video"
                            : kind === "image"
                              ? "View image"
                              : "Open"}
                    </Button>
                    {canUpload && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={async () => {
                          const result = await removePartResource(r.id);
                          if (result.ok) toast.success("Resource removed");
                          else toast.error("Could not remove resource", { description: result.detail });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {open && <ResourceOpenPanel resource={r} />}
              </div>
            );
          })}
          {scoped.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {isStudent
                ? "No resources available for your enrolled courses yet."
                : isAdmin
                  ? "No resources uploaded yet. Choose any course above to add one."
                  : "No resources uploaded yet."}
            </p>
          )}
          <DataPagination
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            from={paged.from}
            to={paged.to}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </>
  );
}

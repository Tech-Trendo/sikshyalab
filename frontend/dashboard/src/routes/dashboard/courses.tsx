import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { DashboardSectionLinks } from "@/components/dashboard/DashboardSectionLinks";
import { useAuth } from "@/components/dashboard/AuthContext";
import { BulkActions } from "@/components/dashboard/BulkActions";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { useDashboardData } from "@/components/dashboard/DashboardDataContext";
import { useTeacherScope } from "@/components/dashboard/useTeacherScope";
import { useStudentScope } from "@/components/dashboard/useStudentScope";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Users, Banknote, Star, Plus, Edit, Eye, Trash2 } from "lucide-react";
import { inr, type Course } from "@/lib/mock";
import { paginate } from "@/lib/dashboard-utils";
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CourseImagePicker } from "@/components/dashboard/CourseImagePicker";
import { uploadCourseThumbnail } from "@/lib/api";
import { courseEndpoints } from "@/lib/api-endpoints";
import { apiMutateDetailed } from "@/lib/dashboard-api";
import { useReviewsQuery } from "@/hooks/useCmsQueries";
import { Rating } from "@/components/ui/Rating";
import {
  averageRating,
  averageRatingForCourse,
  formatRating,
  reviewCountForCourse,
} from "@/lib/rating";
import { groupCoursesByCategory } from "@/lib/course-categories";

export const Route = createFileRoute("/dashboard/courses")({
  component: CoursesDash,
});


const csvHeaders = ["slug", "title", "level", "mode", "duration", "price"];
const emptyForm = {
  title: "",
  level: "Beginner" as Course["level"],
  mode: "Online" as Course["mode"],
  duration: "",
  price: "",
  instructor: "",
  tagline: "",
  description: "",
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
  categoryIds: [] as string[],
};

function CoursesDash() {
  const { isAdmin, isStudent, isTeacher, user } = useAuth();
  const {
    teachers,
    courses: allCourses,
    courseCategories,
    addCourse,
    updateCourse,
    updateCourseLocal,
    removeCourse,
    importCourses,
  } = useDashboardData();
  const { myCourses: teacherCourses } = useTeacherScope();
  const { myCourses: studentCourses, paid } = useStudentScope();
  const { data: reviews = [] } = useReviewsQuery();
  const courses = isStudent ? studentCourses : isTeacher ? teacherCourses : allCourses;
  const canManage = isAdmin && !isTeacher && !isStudent;
  const viewOnly = isStudent;
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const avgRating = useMemo(() => averageRating(reviews), [reviews]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [coverPreview, setCoverPreview] = useState("");
  const [coverFile, setCoverFile] = useState<File | undefined>();
  const [deletingCourse, setDeletingCourse] = useState<string | null>(null);
  const paged = paginate(courses, page);
  const totalStudents = courses.reduce((n, c) => n + c.students, 0);
  const totalRevenue = courses.reduce((n, c) => n + c.students * c.price, 0);
  const coursesByCategory = useMemo(
    () =>
      groupCoursesByCategory(paged.items, {
        mode: "primary",
        categoryOrder: courseCategories.map((c) => c.name),
      }),
    [paged.items, courseCategories],
  );

  const openAdd = () => {
    setEditing(null);
    setCoverPreview("");
    setCoverFile(undefined);
    setForm({
      ...emptyForm,
      instructor: teachers[0]?.name || "",
      categoryIds: [],
    });
    setFormOpen(true);
  };

  const openEdit = (c: Course) => {
    setEditing(c);
    setCoverPreview(c.cover);
    setCoverFile(undefined);
    const names = c.categories?.length ? c.categories : c.category ? [c.category] : [];
    const ids = courseCategories.filter((cat) => names.includes(cat.name)).map((cat) => cat.id);
    setForm({
      title: c.title,
      level: c.level,
      mode: c.mode,
      duration: c.duration,
      price: String(c.price),
      instructor: c.instructor,
      tagline: c.tagline,
      description: c.description,
      metaTitle: c.metaTitle || c.title,
      metaDescription: c.metaDescription || c.tagline || c.description.slice(0, 160),
      metaKeywords: c.metaKeywords || "",
      categoryIds: ids,
    });
    setFormOpen(true);
  };

  const toggleCategory = (id: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      categoryIds: checked ? [...prev.categoryIds, id] : prev.categoryIds.filter((x) => x !== id),
    }));
  };

  const selectedCategoryNames = () =>
    courseCategories.filter((c) => form.categoryIds.includes(c.id)).map((c) => c.name);

  const deleteCourse = async (c: Course) => {
    if (!confirm(`Delete course "${c.title}" and all its chapters/parts?`)) return;
    setDeletingCourse(c.slug);
    try {
      const res = await apiMutateDetailed(courseEndpoints.detail(c.slug), "DELETE");
      if (res.status >= 200 && res.status < 300) {
        toast.success(`Deleted ${c.title}`);
        removeCourse(c.slug);
      } else {
        toast.error(res.error || "Could not delete course");
      }
    } finally {
      setDeletingCourse(null);
    }
  };

  const saveCourse = async () => {
    if (!form.title.trim()) {
      toast.error("Course title is required");
      return;
    }
    if (form.categoryIds.length === 0) {
      toast.error("Select at least one category");
      return;
    }
    const price = Number(form.price) || 0;
    const cats = selectedCategoryNames();

    if (editing) {
      // Persist fields first, then upload thumbnail to the existing course slug
      updateCourse(editing.slug, {
        title: form.title,
        category: cats[0] || "General",
        categories: cats,
        level: form.level,
        mode: form.mode,
        duration: form.duration,
        price,
        instructor: form.instructor,
        tagline: form.tagline || form.title,
        description: form.description,
        metaTitle: form.metaTitle.trim() || form.title,
        metaDescription: form.metaDescription.trim(),
        metaKeywords: form.metaKeywords.trim(),
      });

      if (coverFile) {
        const uploaded = await uploadCourseThumbnail(editing.slug, coverFile);
        if (uploaded) {
          // Cache-bust so the new file replaces any prior thumbnail in the UI
          const bust = `${uploaded}${uploaded.includes("?") ? "&" : "?"}v=${Date.now()}`;
          // Thumbnail already persisted by upload endpoint — local state only
          updateCourseLocal(editing.slug, { cover: bust });
        } else {
          toast.error("Course saved, but thumbnail upload failed");
        }
      }
      toast.success(`Updated ${form.title}`);
    } else {
      // Create course first, then upload thumbnail (upload needs an existing slug)
      const ok = await addCourse({
        title: form.title,
        category: cats[0] || "General",
        categories: cats,
        level: form.level,
        mode: form.mode,
        duration: form.duration,
        price,
        instructor: form.instructor,
        tagline: form.tagline || form.title,
        description: form.description,
        metaTitle: form.metaTitle.trim() || form.title,
        metaDescription: form.metaDescription.trim(),
        metaKeywords: form.metaKeywords.trim(),
        slug: "",
        cover: "",
        coverFile,
        isPublished: true,
      });
      if (ok) {
        toast.success(`Created ${form.title}`);
      } else {
        toast.error(
          "Could not create course on the API — check you are logged in as admin and try again",
        );
      }
    }
    setFormOpen(false);
  };

  return (
    <>
      <PageHeader
        title={isStudent || isTeacher ? "My Courses" : "Courses"}
        subtitle={
          isStudent
            ? paid
              ? "Courses you have enrolled and paid for (view only)."
              : "No paid enrollments yet. Complete fee payment to unlock courses."
            : isTeacher
              ? "Courses assigned to you — manage chapters and parts."
              : "Manage courses, chapters and content."
        }
        action={
          viewOnly && !canManage ? (
            <BulkActions
              entity="courses"
              csvHeaders={csvHeaders}
              showImport={false}
              showExport={false}
              exportHeaders={["Title", "Level", "Mode", "Duration"]}
              exportRows={courses.map((c) => [c.title, c.level, c.mode, c.duration])}
            />
          ) : canManage ? (
            <div className="flex flex-wrap gap-2">
              <BulkActions
                entity="courses"
                csvHeaders={csvHeaders}
                csvSampleRows={[]}
                showExport
                exportHeaders={["Title", "Level", "Mode", "Duration", "Price"]}
                exportRows={courses.map((c) => [c.title, c.level, c.mode, c.duration, c.price])}
                onImport={(rows) => toast.success(`Imported ${importCourses(rows)} course(s)`)}
              />
              <Button size="sm" className="btn-highlight" onClick={openAdd}>
                <Plus className="mr-1 h-4 w-4" /> New course
              </Button>
            </div>
          ) : (
            <BulkActions
              entity="courses"
              csvHeaders={csvHeaders}
              showImport={false}
              showExport={false}
              exportHeaders={["Title", "Level", "Mode", "Duration"]}
              exportRows={courses.map((c) => [c.title, c.level, c.mode, c.duration])}
            />
          )
        }
      />

      <div
        className={`grid gap-4 ${isStudent ? "md:grid-cols-3" : canManage ? "md:grid-cols-4" : "md:grid-cols-3"}`}
      >
        <StatCard label="Courses" value={courses.length} icon={BookOpen} tone="primary" />
        {!isStudent && (
          <StatCard
            label="Learners"
            value={totalStudents.toLocaleString()}
            icon={Users}
            tone="info"
          />
        )}
        {canManage && (
          <StatCard label="Revenue" value={inr(totalRevenue)} icon={Banknote} tone="highlight" />
        )}
        <StatCard label="Avg rating" value={formatRating(avgRating)} icon={Star} tone="success" />
      </div>

      <div className="mt-6 space-y-8">
        {coursesByCategory.map((group) => (
          <section key={group.category} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {group.category}
              </h2>
              <span className="text-xs text-muted-foreground">
                {group.courses.length} course{group.courses.length === 1 ? "" : "s"}
              </span>
            </div>
            {group.courses.map((c) => {
              const courseRating = averageRatingForCourse(reviews, c.title) ?? c.rating;
              const courseReviews = reviewCountForCourse(reviews, c.title);
              return (
                <Card key={c.slug} className="border-border/60">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        key={c.cover || "placeholder"}
                        src={c.cover || "/images/theme/course-placeholder.svg"}
                        className="aspect-[16/9] h-auto w-28 rounded-md object-cover"
                        alt={c.cover ? c.title : `${c.title} — no image`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        {(c.categories?.length ? c.categories : [c.category])
                          .filter(Boolean)
                          .join(" · ") || "Uncategorized"}
                        {" • "}
                        {c.level} • {c.duration} • {c.mode}
                      </p>
                      <h3 className="mt-1 text-sm font-semibold">{c.title}</h3>

                      <div className="mt-2">
                        <Rating
                          value={courseRating}
                          size="sm"
                          showValue
                          count={courseReviews || null}
                          emptyLabel="No ratings yet"
                        />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                        {!isStudent && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-4 w-4" /> {c.students}
                          </span>
                        )}
                        {isStudent && (
                          <span className="text-xs text-muted-foreground">
                            Instructor: {c.instructor}
                          </span>
                        )}
                        {canManage && (
                          <span className="font-semibold text-primary">{inr(c.price)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      {canManage && (
                        <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                          <Edit className="mr-1 h-3.5 w-3.5" /> Edit
                        </Button>
                      )}
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => void deleteCourse(c)}
                          disabled={deletingCourse === c.slug}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                        </Button>
                      )}

                      <Button
                        size="sm"
                        onClick={() => {
                          navigate({ to: `/dashboard/course-content/${c.slug}` });
                        }}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />{" "}
                        {isStudent ? "View content" : "Content"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        ))}

        {courses.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {isStudent ? "No paid courses available yet." : "No courses assigned to you."}
          </p>
        )}
      </div>
      <DataPagination
        page={paged.page}
        totalPages={paged.totalPages}
        total={paged.total}
        from={paged.from}
        to={paged.to}
        onPageChange={setPage}
      />
      {canManage && (
        <DashboardSectionLinks role={user.role} section="/dashboard/courses" className="mt-6" />
      )}

      {canManage && (
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit course" : "New course"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <CourseImagePicker
                  value={coverPreview}
                  onChange={(preview, file) => {
                    setCoverPreview(preview);
                    setCoverFile(file);
                  }}
                  onClear={() => {
                    setCoverPreview("");
                    setCoverFile(undefined);
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Title</Label>
                <Input
                  className="mt-1.5"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Categories</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select one or more categories for this course.
                </p>
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-3">
                  {courseCategories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No categories yet. Create them under Academics → Categories.
                    </p>
                  ) : (
                    courseCategories.map((cat) => (
                      <label
                        key={cat.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={form.categoryIds.includes(cat.id)}
                          onCheckedChange={(v) => toggleCategory(cat.id, !!v)}
                        />
                        <span className="text-sm font-medium">{cat.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div>
                <Label>Level</Label>
                <Select
                  value={form.level}
                  onValueChange={(v) => setForm({ ...form, level: v as Course["level"] })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mode</Label>
                <Select
                  value={form.mode}
                  onValueChange={(v) => setForm({ ...form, mode: v as Course["mode"] })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Online">Online</SelectItem>
                    <SelectItem value="Physical">Physical</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration</Label>
                <Input
                  className="mt-1.5"
                  placeholder="e.g. 3 months"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                />
              </div>
              <div>
                <Label>Price (Rs)</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  placeholder="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div>
                <Label>Instructor</Label>
                <Select
                  value={form.instructor}
                  onValueChange={(v) => setForm({ ...form, instructor: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select instructor" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Tagline</Label>
                <Input
                  className="mt-1.5"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  className="mt-1.5"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="mb-2 text-sm font-semibold">SEO (public course page)</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Meta title and description appear in Google and social previews for{" "}
                  <span className="font-mono">/courses/{editing?.slug || "…"}</span>.
                </p>
                <div className="grid gap-3">
                  <div>
                    <Label>Meta title</Label>
                    <Input
                      className="mt-1.5"
                      maxLength={70}
                      value={form.metaTitle}
                      onChange={(e) => setForm({ ...form, metaTitle: e.target.value })}
                      placeholder={form.title || "Course meta title"}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {form.metaTitle.length}/70
                    </p>
                  </div>
                  <div>
                    <Label>Meta description</Label>
                    <Textarea
                      className="mt-1.5"
                      rows={3}
                      maxLength={320}
                      value={form.metaDescription}
                      onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
                      placeholder="Write a clear 120–160 character summary for search results"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {form.metaDescription.length}/320
                    </p>
                  </div>
                  <div>
                    <Label>Meta keywords</Label>
                    <Input
                      className="mt-1.5"
                      value={form.metaKeywords}
                      onChange={(e) => setForm({ ...form, metaKeywords: e.target.value })}
                      placeholder="web development, react, career"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void saveCourse()}>
                {editing ? "Save changes" : "Create course"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
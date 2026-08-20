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
import { BookOpen, Users, Banknote, Star, Plus, Edit, Eye, Trash2 } from "lucide-react";
import { inr, type Course } from "@/lib/mock";
import { paginate, slugify } from "@/lib/dashboard-utils";
import { courseSlugError, normalizeCourseSlug } from "@/lib/course-slug";
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
import { RichTextEditor } from "@/components/dashboard/RichTextEditor";
import { FormTabNav } from "@/components/dashboard/FormTabNav";
import { SeoFieldsPanel } from "@/components/dashboard/SeoFieldsPanel";
import { HighlightsListEditor } from "@/components/dashboard/HighlightsListEditor";
import { FaqsListEditor, type FaqDraft } from "@/components/dashboard/FaqsListEditor";
import { useDirtyForm } from "@/hooks/useDirtyForm";
import { courseEditorApi, type CourseHighlightInput } from "@/lib/course-editor-api";
import { uploadCourseOgImage, uploadCourseThumbnail } from "@/lib/api";
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
import { requirePermission } from "@/lib/permission-guards";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/dashboard/courses")({
  beforeLoad: requirePermission("courses.view"),
  component: CoursesDash,
});


const csvHeaders = ["slug", "title", "level", "mode", "duration", "price"];

function nestedHighlights(rows: CourseHighlightInput[]) {
  return rows
    .filter((h) => h.heading.trim() || h.description.trim())
    .map((h) => ({ heading: h.heading.trim(), description: h.description.trim() }));
}

function nestedFaqs(rows: FaqDraft[]) {
  return rows
    .filter((f) => f.question.trim() && f.answer.trim())
    .map((f, order) => ({
      question: f.question.trim(),
      answer: f.answer.trim(),
      order,
    }));
}

const emptyForm = {
  title: "",
  slug: "",
  level: "Beginner" as Course["level"],
  mode: "Online" as Course["mode"],
  duration: "",
  price: "",
  instructor: "",
  description: "",
  metaTitle: "",
  metaDescription: "",
  ogImage: "",
  whyTitle: "",
  highlights: [] as CourseHighlightInput[],
  faqs: [] as FaqDraft[],
  categoryIds: [] as string[],
};

function CoursesDash() {
  const { isAdmin, isStudent, isTeacher, user } = useAuth();
  const { hasPermission, loading: permsLoading } = usePermissions();
  const {
    teachers,
    courses: allCourses,
    courseCategories,
    addCourse,
    updateCourse,
    importCourses,
    refreshData,
  } = useDashboardData();
  const { myCourses: teacherCourses } = useTeacherScope();
  const { myCourses: studentCourses, paid } = useStudentScope();
  const { data: reviews = [] } = useReviewsQuery();
  const courses = isStudent ? studentCourses : isTeacher ? teacherCourses : allCourses;
  const orderedCourses = useMemo(
    () =>
      [...courses].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      }),
    [courses],
  );
  const permReady = !permsLoading;
  const canCreateCourses = permReady && hasPermission("courses.create");
  const canUpdateCourses = permReady && hasPermission("courses.update");
  const canDeleteCourses = permReady && hasPermission("courses.delete");
  const canExportCourses = permReady && hasPermission("courses.export");
  const canManage = canCreateCourses || canUpdateCourses || canDeleteCourses || canExportCourses;
  const viewOnly = isStudent || !canManage;
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const avgRating = useMemo(() => averageRating(reviews), [reviews]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formBaseline, setFormBaseline] = useState<typeof emptyForm | null>(null);
  const [formTab, setFormTab] = useState("details");
  const [coverPreview, setCoverPreview] = useState("");
  const [coverFile, setCoverFile] = useState<File | undefined>();
  const [ogFile, setOgFile] = useState<File | undefined>();
  const [deletingCourse, setDeletingCourse] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const courseFormDirty = useDirtyForm(
    { form, coverFile, ogFile },
    formBaseline ? { form: formBaseline, coverFile: undefined, ogFile: undefined } : null,
    Boolean(editing),
  );
  const paged = paginate(orderedCourses, page);
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
    setOgFile(undefined);
    setFormTab("details");
    setFormBaseline(null);
    setForm({
      ...emptyForm,
      instructor: teachers[0]?.name || "",
      categoryIds: [],
    });
    setFormOpen(true);
  };

  const openEdit = async (c: Course) => {
    setEditing(c);
    setCoverPreview(c.cover);
    setCoverFile(undefined);
    setOgFile(undefined);
    setFormTab("details");
    const names = c.categories?.length ? c.categories : c.category ? [c.category] : [];
    const ids = courseCategories.filter((cat) => names.includes(cat.name)).map((cat) => cat.id);
    const detail = await courseEditorApi.fetchCourseDetail(c.slug);
    const fromDetail = Array.isArray(detail?.faqs) ? detail.faqs : [];
    const faqs =
      fromDetail.length > 0
        ? fromDetail
        : c._uuid
          ? await courseEditorApi.listFaqs(c._uuid)
          : [];
    const next = {
      title: c.title,
      slug: c.slug,
      level: c.level,
      mode: c.mode,
      duration: c.duration,
      price: String(c.price),
      instructor: c.instructor,
      description: c.description,
      metaTitle: String(detail?.meta_title ?? c.metaTitle ?? ""),
      metaDescription: String(detail?.meta_description ?? c.metaDescription ?? ""),
      ogImage: String(detail?.og_image ?? c.ogImage ?? ""),
      whyTitle: String(detail?.why_this_course_title || ""),
      highlights: Array.isArray(detail?.highlights)
        ? detail!.highlights.map((h) => ({
            heading: String(h.heading || h.title || "").trim(),
            description: String(h.description || h.body || "").trim(),
          }))
        : [],
      faqs: faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
      categoryIds: ids,
    };
    setForm(next);
    setFormBaseline(next);
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
    if (!canDeleteCourses) {
      toast.error("You do not have permission to delete courses");
      return;
    }
    if (!confirm(`Delete course "${c.title}" and all its chapters/parts?`)) return;
    setDeletingCourse(c.slug);
    try {
      const res = await apiMutateDetailed(courseEndpoints.detail(c.slug), "DELETE");
      if (res.status >= 200 && res.status < 300) {
        toast.success(`Deleted ${c.title}`);
        void refreshData();
      } else {
        toast.error(res.error || "Could not delete course");
      }
    } finally {
      setDeletingCourse(null);
    }
  };

  const saveCourse = async () => {
    if (editing && !canUpdateCourses) {
      toast.error("You do not have permission to edit courses");
      return;
    }
    if (!editing && !canCreateCourses) {
      toast.error("You do not have permission to create courses");
      return;
    }
    if (!form.title.trim()) {
      setFormTab("details");
      toast.error("Course title is required");
      return;
    }
    if (form.categoryIds.length === 0) {
      setFormTab("details");
      toast.error("Select at least one category");
      return;
    }
    const price = Number(form.price) || 0;
    const cats = selectedCategoryNames();
    const slugInput = normalizeCourseSlug(form.slug, form.title);
    const slugErr = courseSlugError(slugInput);
    if (slugErr) {
      setFormTab("details");
      toast.error(slugErr);
      return;
    }

    setSaving(true);
    try {
    const highlights = nestedHighlights(form.highlights);
    const faqs = nestedFaqs(form.faqs);
    if (editing) {
      const oldSlug = editing.slug;
      updateCourse(oldSlug, {
        title: form.title,
        slug: slugInput,
        category: cats[0] || "General",
        categories: cats,
        level: form.level,
        mode: form.mode,
        duration: form.duration,
        price,
        instructor: form.instructor,
        description: form.description,
        metaTitle: form.metaTitle.trim() || undefined,
        metaDescription: form.metaDescription.trim() || undefined,
        ogImage: form.ogImage.startsWith("blob:") ? undefined : form.ogImage,
        whyThisCourseTitle: form.whyTitle.trim(),
        highlights,
        faqs,
      });

      const thumbSlug = slugInput !== oldSlug ? slugInput : oldSlug;
      if (coverFile) {
        const uploaded = await uploadCourseThumbnail(thumbSlug, coverFile);
        if (uploaded) {
          const bust = `${uploaded}${uploaded.includes("?") ? "&" : "?"}v=${Date.now()}`;
          updateCourse(thumbSlug, { cover: bust });
        } else {
          toast.error("Course saved, but thumbnail upload failed");
        }
      }
      if (ogFile) {
        const uploadedOg = await uploadCourseOgImage(thumbSlug, ogFile);
        if (!uploadedOg) toast.error("Course saved, but OG image upload failed");
      }
      toast.success(`Updated ${form.title}`);
    } else {
      const ok = await addCourse({
        title: form.title,
        slug: slugInput,
        category: cats[0] || "General",
        categories: cats,
        level: form.level,
        mode: form.mode,
        duration: form.duration,
        price,
        instructor: form.instructor,
        description: form.description,
        metaTitle: form.metaTitle.trim() || undefined,
        metaDescription: form.metaDescription.trim() || undefined,
        ogImage: form.ogImage.startsWith("blob:") ? undefined : form.ogImage,
        whyThisCourseTitle: form.whyTitle.trim(),
        highlights,
        faqs,
        cover: "",
        coverFile,
        ogFile,
        isPublished: true,
      });
      if (ok) {
        toast.success(`Created ${form.title}`);
      } else {
        toast.error(
          "Could not create course on the API — check you are logged in as admin and try again",
        );
        return;
      }
    }
    setFormOpen(false);
    } finally {
      setSaving(false);
    }
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
              ? canManage
                ? "Courses assigned to you — manage course details and curriculum."
                : "Courses assigned to you — view curriculum and content."
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
                showImport={canCreateCourses}
                showExport={canExportCourses}
                exportHeaders={["Title", "Level", "Mode", "Duration", "Price"]}
                exportRows={courses.map((c) => [c.title, c.level, c.mode, c.duration, c.price])}
                onImport={
                  canCreateCourses
                    ? (rows) => toast.success(`Imported ${importCourses(rows)} course(s)`)
                    : undefined
                }
              />
              {canCreateCourses ? (
                <Button size="sm" className="btn-highlight" onClick={openAdd}>
                  <Plus className="mr-1 h-4 w-4" /> New course
                </Button>
              ) : null}
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
        {canExportCourses && (
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
                        {canExportCourses && (
                          <span className="font-semibold text-primary">{inr(c.price)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      {canUpdateCourses && (
                        <Button variant="outline" size="sm" onClick={() => void openEdit(c)}>
                          <Edit className="mr-1 h-3.5 w-3.5" /> Edit
                        </Button>
                      )}
                      {canDeleteCourses && (
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
      {canManage && isAdmin && (
        <DashboardSectionLinks role={user.role} section="/dashboard/courses" className="mt-6" />
      )}

      {(canCreateCourses || canUpdateCourses) && (
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit course" : "New course"}</DialogTitle>
            </DialogHeader>
            <FormTabNav
              value={formTab}
              onChange={setFormTab}
              tabs={[
                {
                  id: "details",
                  label: "Course Details",
                  error: !form.title.trim() || form.categoryIds.length === 0,
                },
                { id: "seo", label: "SEO" },
                { id: "why", label: "Why This Course" },
                { id: "faqs", label: "FAQs" },
              ]}
            />
            {formTab === "details" ? (
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
                <Label htmlFor="course-slug">Slug</Label>
                <Input
                  id="course-slug"
                  className="mt-1.5 font-mono text-sm"
                  value={form.slug}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                    })
                  }
                  onBlur={() => {
                    if (!form.slug.trim() && form.title.trim()) {
                      setForm((prev) => ({
                        ...prev,
                        slug: slugify(prev.title),
                      }));
                    }
                  }}
                  placeholder={form.title ? slugify(form.title) : "course-url-slug"}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Public URL:{" "}
                  <span className="font-mono">
                    /courses/{form.slug.trim() || slugify(form.title) || "…"}
                  </span>
                  . Lowercase letters, numbers, and hyphens only.
                </p>
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
                <Label htmlFor="course-description">Description</Label>
                <div className="mt-1.5">
                  <RichTextEditor
                    id="course-description"
                    value={form.description}
                    placeholder="Describe the course"
                    onChange={(html) => setForm({ ...form, description: html })}
                  />
                </div>
              </div>
            </div>
            ) : null}
            {formTab === "seo" ? (
              <SeoFieldsPanel
                value={{
                  metaTitle: form.metaTitle,
                  metaDescription: form.metaDescription,
                  ogImage: form.ogImage,
                }}
                titleFallback={form.title}
                onOgFile={setOgFile}
                onChange={(seo) =>
                  setForm({
                    ...form,
                    metaTitle: seo.metaTitle,
                    metaDescription: seo.metaDescription,
                    ogImage: seo.ogImage || "",
                  })
                }
              />
            ) : null}
            {formTab === "why" ? (
              <HighlightsListEditor
                title={form.whyTitle}
                onTitleChange={(whyTitle) => setForm({ ...form, whyTitle })}
                highlights={form.highlights}
                onChange={(highlights) => setForm({ ...form, highlights })}
                canEdit
                busy={saving}
              />
            ) : null}
            {formTab === "faqs" ? (
              <FaqsListEditor
                items={form.faqs}
                onChange={(faqs) => setForm({ ...form, faqs })}
                canEdit
                busy={saving}
              />
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={saving || Boolean(editing && !courseFormDirty)}
                onClick={() => void saveCourse()}
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Create course"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
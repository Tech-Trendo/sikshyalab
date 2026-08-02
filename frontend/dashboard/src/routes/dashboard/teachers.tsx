import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { BulkActions } from "@/components/dashboard/BulkActions";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { useDashboardData, type Teacher } from "@/components/dashboard/DashboardDataContext";
import { useAuth } from "@/components/dashboard/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/dashboard/PersonAvatar";
import { GraduationCap, BookOpen, Star, Plus, Mail, Briefcase, Layers, Trash2 } from "lucide-react";
import { paginate } from "@/lib/dashboard-utils";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { credentialsMailto } from "@/lib/credentials-mailto";
import { useReviewsQuery } from "@/hooks/useCmsQueries";
import { Rating } from "@/components/ui/Rating";
import { averageRating, formatRating } from "@/lib/rating";
import { apiMutateDetailed } from "@/lib/dashboard-api";

export const Route = createFileRoute("/dashboard/teachers")({
  component: TeachersPage,
});

const csvHeaders = ["name", "role", "email", "exp", "courses"];
const emptyForm = { name: "", role: "", email: "", exp: "", bio: "" };

function TeachersPage() {
  const { teachers, courses, batches, addTeacher, assignCoursesToTeacher, assignBatchesToTeacher, importTeachers, refreshData } = useDashboardData();
  const { isAdmin } = useAuth();
  const { data: reviews = [] } = useReviewsQuery();
  const [page, setPage] = useState(1);
  const [profile, setProfile] = useState<Teacher | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBatchOpen, setAssignBatchOpen] = useState(false);
  const [assignTeacher, setAssignTeacher] = useState<Teacher | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [deletingTeacher, setDeletingTeacher] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const paged = paginate(teachers, page);
  const avgRating = useMemo(() => averageRating(reviews), [reviews]);
  const activeBatches = useMemo(() => batches.filter((b) => b.status === "Ongoing").length, [batches]);

  const teacherBatches = useMemo(() => {
    if (!assignTeacher) return [];
    return batches.filter((b) => b.teacher === assignTeacher.name);
  }, [assignTeacher, batches]);

  const openAssign = (t: Teacher) => {
    setAssignTeacher(t);
    setSelectedCourses(courses.filter((c) => c.instructor === t.name).map((c) => c.title));
    setAssignOpen(true);
  };

  const openAssignBatches = (t: Teacher) => {
    setAssignTeacher(t);
    setSelectedBatches(batches.filter((b) => b.teacher === t.name).map((b) => b.id));
    setAssignBatchOpen(true);
  };

  const deleteTeacher = async (t: Teacher) => {
    if (!t._uuid) {
      toast.error("Teacher id missing");
      return;
    }
    if (!window.confirm(`Delete ${t.name}? This cannot be undone.`)) return;
    setDeletingTeacher(String(t._uuid));
    try {
      const res = await apiMutateDetailed(`/teachers/profiles/${encodeURIComponent(String(t._uuid))}/`, "DELETE");
      if (res.status >= 200 && res.status < 300) {
        toast.success(`${t.name} deleted`);
        void refreshData();
      } else {
        toast.error(res.error || "Could not delete teacher");
      }
    } finally {
      setDeletingTeacher(null);
    }
  };

  const toggleCourse = (title: string, checked: boolean) => {
    setSelectedCourses((prev) => (checked ? [...prev, title] : prev.filter((t) => t !== title)));
  };

  const toggleBatch = (id: string, checked: boolean) => {
    setSelectedBatches((prev) => (checked ? [...prev, id] : prev.filter((b) => b !== id)));
  };

  const saveTeacher = async () => {
    if (!form.name.trim() || !form.role.trim() || !form.email.trim()) {
      toast.error("Name, role, and email are required");
      return;
    }
    try {
      const res = await addTeacher({
        ...form,
        email: form.email.trim(),
        bio: form.bio || `${form.role} at ShikshaLab.`,
      });
      const pwd = res && "temporaryPassword" in (res || {}) ? res?.temporaryPassword : undefined;
      const emailed = Boolean(res && "emailSent" in (res || {}) && res?.emailSent);
      const emailError = res && "emailError" in (res || {}) ? res?.emailError : undefined;
      if (emailed) {
        toast.success(`Added ${form.name}`, {
          description: `Login credentials emailed to ${form.email.trim()}${pwd ? ` · Temp password: ${pwd}` : ""}`,
          duration: 15000,
        });
      } else if (pwd) {
        const mailto = credentialsMailto({
          to: form.email.trim(),
          name: form.name,
          role: "TEACHER",
          temporaryPassword: pwd,
        });
        toast.error(`Added ${form.name}, but email was not sent`, {
          description: `${emailError || "SMTP not configured"}. Temp password: ${pwd}`,
          duration: 20000,
          action: {
            label: "Open mail to teacher",
            onClick: () => {
              window.location.href = mailto;
            },
          },
        });
      } else {
        toast.success(`Added ${form.name}`);
      }
      setFormOpen(false);
      setForm(emptyForm);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add teacher");
    }
  };

  return (
    <>
      <PageHeader
        title="Teachers"
        subtitle="Manage instructors and assign courses and batches."
        action={
          <div className="flex flex-wrap gap-2">
            <BulkActions
              entity="teachers"
              csvHeaders={csvHeaders}
              csvSampleRows={[]}
              showExport
              exportHeaders={["Name", "Role", "Experience", "Courses"]}
              exportRows={teachers.map((t) => [t.name, t.role, t.exp, t.courses])}
              onImport={(rows) => toast.success(`Imported ${importTeachers(rows)} teacher(s)`)}
            />
            <Button size="sm" className="btn-highlight" onClick={() => { setForm(emptyForm); setFormOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Add teacher
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total teachers" value={teachers.length} icon={GraduationCap} tone="primary" />
        <StatCard label="Active courses" value={courses.length} icon={BookOpen} tone="info" />
        <StatCard label="Avg rating" value={formatRating(avgRating)} icon={Star} tone="highlight" />
        <StatCard label="Active batches" value={activeBatches} icon={Plus} tone="success" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paged.items.map((t) => (
          <Card key={t.name} className="overflow-hidden border-border/60">
            <div className="h-20 bg-gradient-to-br from-primary/20 via-primary/5 to-highlight/20" />
            <CardContent className="-mt-10 p-5">
              <PersonAvatar src={t.avatar} name={t.name} className="h-16 w-16 ring-4 ring-background" />
              <p className="mt-3 text-base font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.role}</p>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{t.bio}</p>
              <div className="mt-2">
                <Rating
                  value={averageRating(
                    reviews.filter((r) =>
                      courses.some((c) => c.instructor === t.name && c.title === r.course_name),
                    ),
                  )}
                  size="sm"
                  showValue
                  emptyLabel="No ratings yet"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{t.exp}</Badge>
                <Badge variant="secondary">{t.courses} courses</Badge>
                <Badge className="bg-success/15 text-success hover:bg-success/20">Active</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setProfile(t)}>View profile</Button>
                <Button size="sm" onClick={() => openAssign(t)}>Assign courses</Button>
                <Button variant="secondary" size="sm" className="col-span-2" onClick={() => openAssignBatches(t)}>
                  <Layers className="mr-1 h-3.5 w-3.5" /> Assign batches
                </Button>
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="col-span-2"
                    onClick={() => void deleteTeacher(t)}
                    disabled={deletingTeacher === String(t._uuid)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Delete teacher
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <DataPagination page={paged.page} totalPages={paged.totalPages} total={paged.total} from={paged.from} to={paged.to} onPageChange={setPage} />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add teacher</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name</Label><Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input className="mt-1.5" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="teacher@example.com" /></div>
            <div><Label>Role</Label><Input className="mt-1.5" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Senior Full-Stack Instructor" /></div>
            <div><Label>Experience</Label><Input className="mt-1.5" value={form.exp} onChange={(e) => setForm({ ...form, exp: e.target.value })} placeholder="5+ yrs" /></div>
            <div><Label>Bio</Label><Textarea className="mt-1.5" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={saveTeacher}>Add teacher</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!profile} onOpenChange={(o) => !o && setProfile(null)}>
        <DialogContent className="max-w-md">
          {profile && (
            <>
              <DialogHeader><DialogTitle>Teacher profile</DialogTitle></DialogHeader>
              <div className="flex items-center gap-4">
                <PersonAvatar src={profile.avatar} name={profile.name} className="h-20 w-20" />
                <div>
                  <p className="text-lg font-semibold">{profile.name}</p>
                  <p className="text-sm text-muted-foreground">{profile.role}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{profile.bio}</p>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-muted-foreground" /> {profile.exp} experience</p>
                <p className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-muted-foreground" /> {profile.courses} active courses</p>
                <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {profile.name.toLowerCase().replace(/\s+/g, ".")}@shikshalab.io</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setProfile(null)}>Close</Button>
                <Button onClick={() => { setProfile(null); openAssign(profile); }}>Assign courses</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign courses{assignTeacher ? ` — ${assignTeacher.name}` : ""}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Select one or more courses for this teacher.</p>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border/60 p-3">
            {courses.map((c) => (
              <label key={c.slug} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50">
                <Checkbox
                  checked={selectedCourses.includes(c.title)}
                  onCheckedChange={(v) => toggleCourse(c.title, !!v)}
                />
                <span>
                  <span className="block text-sm font-medium">{c.title}</span>
                  <span className="text-xs text-muted-foreground">{c.category} · {c.level}</span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              disabled={!assignTeacher || selectedCourses.length === 0}
              onClick={() => {
                if (assignTeacher) {
                  assignCoursesToTeacher(assignTeacher.name, selectedCourses);
                  toast.success(`Assigned ${selectedCourses.length} course(s) to ${assignTeacher.name}`);
                }
                setAssignOpen(false);
              }}
            >
              Assign {selectedCourses.length > 0 ? `(${selectedCourses.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignBatchOpen} onOpenChange={setAssignBatchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign batches{assignTeacher ? ` — ${assignTeacher.name}` : ""}</DialogTitle>
          </DialogHeader>
          {teacherBatches.length > 0 && (
            <p className="text-xs text-muted-foreground">Currently assigned: {teacherBatches.map((b) => b.id).join(", ")}</p>
          )}
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border/60 p-3">
            {batches.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50">
                <Checkbox
                  checked={selectedBatches.includes(b.id)}
                  onCheckedChange={(v) => toggleBatch(b.id, !!v)}
                />
                <span>
                  <span className="block text-sm font-medium">{b.id}</span>
                  <span className="text-xs text-muted-foreground">{b.course} · {b.shift}</span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignBatchOpen(false)}>Cancel</Button>
            <Button
              disabled={!assignTeacher || selectedBatches.length === 0}
              onClick={() => {
                if (assignTeacher) {
                  assignBatchesToTeacher(assignTeacher.name, selectedBatches);
                  toast.success(`Assigned ${selectedBatches.length} batch(es) to ${assignTeacher.name}`);
                }
                setAssignBatchOpen(false);
              }}
            >
              Assign {selectedBatches.length > 0 ? `(${selectedBatches.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

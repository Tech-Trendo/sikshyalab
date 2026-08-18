import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard, ResponsiveTable } from "@/components/dashboard/DashboardLayout";
import { BulkActions } from "@/components/dashboard/BulkActions";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { useDashboardData, type Student } from "@/components/dashboard/DashboardDataContext";
import { useTeacherScope } from "@/components/dashboard/useTeacherScope";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/dashboard/PersonAvatar";
import { Users, UserCheck, UserPlus, GraduationCap, MoreHorizontal, Plus, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { inr } from "@/lib/mock";
import { paginate } from "@/lib/dashboard-utils";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { credentialsMailto } from "@/lib/credentials-mailto";
import { useDirtyForm } from "@/hooks/useDirtyForm";

export const Route = createFileRoute("/dashboard/students")({
  component: StudentsPage,
});

const csvHeaders = ["id", "name", "email", "phone", "course", "batch", "shift", "status"];
const emptyForm = { name: "", email: "", phone: "", course: "", batch: "", shift: "Evening", status: "Active" as Student["status"] };

function StudentsPage() {
  const { courses, batches, addStudent, updateStudent, deactivateStudent, reactivateStudent, deleteStudent, importStudents } = useDashboardData();
  const { isTeacher, myStudents } = useTeacherScope();
  const students = myStudents;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [viewing, setViewing] = useState<Student | null>(null);
  const [progressFor, setProgressFor] = useState<Student | null>(null);
  const [progressValue, setProgressValue] = useState("0");
  const [progressNote, setProgressNote] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [formBaseline, setFormBaseline] = useState<typeof emptyForm | null>(null);
  const studentDirty = useDirtyForm(form, formBaseline, Boolean(editing));
  const [progressBaseline, setProgressBaseline] = useState<{ progressValue: string; progressNote: string } | null>(null);
  const progressDirty = useDirtyForm(
    { progressValue, progressNote },
    progressBaseline,
    Boolean(progressFor),
  );

  const filtered = useMemo(() => students.filter((s) =>
    (q === "" || s.name.toLowerCase().includes(q.toLowerCase()) || s.email.toLowerCase().includes(q.toLowerCase()))
    && (status === "all" || s.status === status)
  ), [students, q, status]);
  const availableBatches = useMemo(() => {
    if (!form.course) return batches;
    return batches.filter((b) => b.course === form.course);
  }, [batches, form.course]);
  const paged = paginate(filtered, page);
  const active = students.filter((s) => s.status === "Active").length;
  const completed = students.filter((s) => s.status === "Completed").length;

  const openAdd = () => {
    setEditing(null);
    setFormBaseline(null);
    const defaultCourse = courses[0]?.title || "";
    const defaultBatches = defaultCourse
      ? batches.filter((b) => b.course === defaultCourse)
      : batches;
    setForm({
      ...emptyForm,
      course: defaultCourse,
      batch: defaultBatches[0]?.id || "",
    });
    setFormOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditing(s);
    const next = {
      name: s.name,
      email: s.email,
      phone: s.phone,
      course: s.course,
      batch: s.batch,
      shift: s.shift,
      status: s.status,
    };
    setForm(next);
    setFormBaseline(next);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!editing && (!form.course.trim() || !form.batch.trim())) {
      toast.error("Course and batch are required");
      return;
    }
    if (editing) {
      updateStudent(editing.id, form);
      toast.success(`Updated ${form.name}`);
    } else {
      try {
        const res = await addStudent(form);
        const pwd = res && "temporaryPassword" in (res || {}) ? res?.temporaryPassword : undefined;
        const emailed = Boolean(res && "emailSent" in (res || {}) && res?.emailSent);
        const emailError = res && "emailError" in (res || {}) ? res?.emailError : undefined;
        if (emailed) {
          toast.success(`Added ${form.name}`, {
            description: `Login credentials emailed to ${form.email}${pwd ? ` · Temp password: ${pwd}` : ""}`,
            duration: 15000,
          });
        } else if (pwd) {
          const mailto = credentialsMailto({
            to: form.email,
            name: form.name,
            role: "STUDENT",
            temporaryPassword: pwd,
          });
          toast.error(`Added ${form.name}, but email was not sent`, {
            description: `${emailError || "SMTP not configured"}. Temp password: ${pwd}`,
            duration: 20000,
            action: {
              label: "Open mail to student",
              onClick: () => {
                window.location.href = mailto;
              },
            },
          });
        } else {
          toast.success(`Added ${form.name}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not add student");
        return;
      }
    }
    setFormOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={isTeacher ? "Students in batches assigned to you." : "Manage learners, enrollments and progress."}
        action={
          <div className="flex flex-wrap gap-2">
            <BulkActions
              entity="students"
              csvHeaders={csvHeaders}
              csvSampleRows={[]}
              showImport={!isTeacher}
              showExport={false}
              exportHeaders={isTeacher
                ? ["ID", "Name", "Email", "Course", "Batch", "Progress", "Status"]
                : ["ID", "Name", "Email", "Course", "Batch", "Shift", "Status", "Progress"]}
              exportRows={filtered.map((s) =>
                isTeacher
                  ? [s.id, s.name, s.email, s.course, s.batch, `${s.progress}%`, s.status]
                  : [s.id, s.name, s.email, s.course, s.batch, s.shift, s.status, `${s.progress}%`],
              )}
              onImport={!isTeacher ? (rows) => toast.success(`Imported ${importStudents(rows)} student(s)`) : undefined}
            />
            {!isTeacher && (
              <Button size="sm" className="btn-highlight" onClick={openAdd}><Plus className="mr-1 h-4 w-4" /> Add student</Button>
            )}
          </div>
        }
      />
      <div className={`grid gap-4 ${isTeacher ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
        <StatCard label="Total" value={students.length} icon={Users} tone="primary" />
        <StatCard label="Active" value={active} icon={UserCheck} tone="success" />
        {!isTeacher && <StatCard label="New this month" value={9} icon={UserPlus} tone="info" />}
        <StatCard label="Graduates" value={completed} icon={GraduationCap} tone="highlight" />
      </div>

      <Card className="mt-6 border-border/60"><CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Deactivated">Deactivated</SelectItem>
              <SelectItem value="On Hold">On Hold</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ResponsiveTable
          mobile={paged.items.map((s) => (
            <Card key={s.id} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <PersonAvatar src={s.avatar} name={s.name} className="h-10 w-10 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewing(s)}>View profile</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setProgressFor(s); const pv = String(s.progress); const pn = s.progressNote || ""; setProgressValue(pv); setProgressNote(pn); setProgressBaseline({ progressValue: pv, progressNote: pn }); }}>Review progress</DropdownMenuItem>
                      {!isTeacher && (
                        <>
                          <DropdownMenuItem onClick={() => openEdit(s)}>Edit</DropdownMenuItem>
                          {s.status === "Deactivated" ? (
                            <DropdownMenuItem
                              onClick={() => {
                                if (!window.confirm(`Reactivate ${s.name}? They will be able to sign in again.`)) return;
                                reactivateStudent(s.id);
                                toast.success(`${s.name} reactivated`);
                              }}
                            >
                              Reactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `Deactivate ${s.name}? They will be logged out and cannot sign in.`,
                                  )
                                ) {
                                  return;
                                }
                                deactivateStudent(s.id);
                                toast.success(`${s.name} deactivated`);
                              }}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (!window.confirm(`Delete ${s.name}? This cannot be undone.`)) return;
                              deleteStudent(s.id);
                              toast.success(`${s.name} deleted`);
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <p><span className="text-muted-foreground">Course:</span> {s.course}</p>
                  <p><span className="text-muted-foreground">Batch:</span> {s.batch}{!isTeacher && ` · ${s.shift}`}</p>
                  <div>
                    <p className="mb-1 text-muted-foreground">Progress: {s.progress}%</p>
                    <Progress value={s.progress} className="h-2" />
                  </div>
                  {!isTeacher && (
                    <p><span className="text-muted-foreground">Fees:</span> {inr(s.fees.paid)} / {inr(s.fees.total)}</p>
                  )}
                  <Badge className={
                    s.status === "Active" ? "bg-success/15 text-success hover:bg-success/20"
                    : s.status === "Completed" ? "bg-primary/15 text-primary hover:bg-primary/20"
                    : s.status === "Deactivated" ? "bg-destructive/15 text-destructive hover:bg-destructive/20"
                    : "bg-warning/15 text-[color:var(--highlight-foreground)]"
                  }>{s.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        >
        <Table>
          <TableHeader><TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Course</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead>Progress</TableHead>
            {!isTeacher && <TableHead>Fees</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {paged.items.map((s) => (
              <TableRow key={s.id}>
                <TableCell><div className="flex items-center gap-3"><PersonAvatar src={s.avatar} name={s.name} className="h-9 w-9" /><div><p className="text-sm font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.email}</p></div></div></TableCell>
                <TableCell className="text-sm">{s.course}</TableCell>
                <TableCell className="text-sm">{s.batch}{!isTeacher && <span className="text-xs text-muted-foreground"> • {s.shift}</span>}</TableCell>
                <TableCell className="w-40"><Progress value={s.progress} className="h-2" /><p className="mt-1 text-xs text-muted-foreground">{s.progress}%</p></TableCell>
                {!isTeacher && (
                  <TableCell className="text-sm"><span className="font-medium">{inr(s.fees.paid)}</span> <span className="text-xs text-muted-foreground">/ {inr(s.fees.total)}</span></TableCell>
                )}
                <TableCell>
                  <Badge className={
                    s.status === "Active" ? "bg-success/15 text-success hover:bg-success/20"
                    : s.status === "Completed" ? "bg-primary/15 text-primary hover:bg-primary/20"
                    : s.status === "Deactivated" ? "bg-destructive/15 text-destructive hover:bg-destructive/20"
                    : "bg-warning/15 text-[color:var(--highlight-foreground)]"
                  }>{s.status}</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewing(s)}>View profile</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setProgressFor(s); const pv = String(s.progress); const pn = s.progressNote || ""; setProgressValue(pv); setProgressNote(pn); setProgressBaseline({ progressValue: pv, progressNote: pn }); }}>Review progress</DropdownMenuItem>
                      {!isTeacher && (
                        <>
                          <DropdownMenuItem onClick={() => openEdit(s)}>Edit</DropdownMenuItem>
                          {s.status === "Deactivated" ? (
                            <DropdownMenuItem
                              onClick={() => {
                                if (!window.confirm(`Reactivate ${s.name}? They will be able to sign in again.`)) return;
                                reactivateStudent(s.id);
                                toast.success(`${s.name} reactivated`);
                              }}
                            >
                              Reactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `Deactivate ${s.name}? They will be logged out and cannot sign in.`,
                                  )
                                ) {
                                  return;
                                }
                                deactivateStudent(s.id);
                                toast.success(`${s.name} deactivated`);
                              }}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (!window.confirm(`Delete ${s.name}? This cannot be undone.`)) return;
                              deleteStudent(s.id);
                              toast.success(`${s.name} deleted`);
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={isTeacher ? 6 : 7} className="text-sm text-muted-foreground">No students found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </ResponsiveTable>
        <DataPagination page={paged.page} totalPages={paged.totalPages} total={paged.total} from={paged.from} to={paged.to} onPageChange={setPage} />
      </CardContent></Card>

      {!isTeacher && (
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit student" : "Add student"}</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Name</Label><Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input className="mt-1.5" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input className="mt-1.5" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div>
                <Label>Course</Label>
                <Select
                  value={form.course}
                  onValueChange={(v) => {
                    const nextBatches = batches.filter((b) => b.course === v);
                    setForm({
                      ...form,
                      course: v,
                      batch: nextBatches[0]?.id || "",
                      shift: nextBatches[0]?.shift || form.shift,
                    });
                  }}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>{courses.map((c) => <SelectItem key={c.slug} value={c.title}>{c.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Batch</Label>
                <Select
                  value={form.batch || undefined}
                  onValueChange={(v) => {
                    const picked = batches.find((b) => b.id === v);
                    setForm({
                      ...form,
                      batch: v,
                      shift: picked?.shift || form.shift,
                    });
                  }}
                  disabled={availableBatches.length === 0}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder={availableBatches.length ? "Select batch" : "No batches for this course"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBatches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.id} — {b.course} ({b.shift})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableBatches.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a batch for this course under Batches first.
                  </p>
                )}
              </div>
              <div>
                <Label>Shift</Label>
                <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Morning", "Daytime", "Evening", "Weekend"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Student["status"] })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Deactivated">Deactivated</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button disabled={Boolean(editing && !studentDirty)} onClick={save}>{editing ? "Save changes" : "Add student"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader><DialogTitle>Student profile</DialogTitle></DialogHeader>
              <div className="flex items-center gap-4">
                <PersonAvatar src={viewing.avatar} name={viewing.name} className="h-16 w-16" />
                <div>
                  <p className="text-lg font-semibold">{viewing.name}</p>
                  <p className="text-sm text-muted-foreground">{viewing.id}</p>
                </div>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">Email:</span> {viewing.email}</p>
                <p><span className="text-muted-foreground">Phone:</span> {viewing.phone}</p>
                <p><span className="text-muted-foreground">Course:</span> {viewing.course}</p>
                <p><span className="text-muted-foreground">Batch:</span> {viewing.batch} ({viewing.shift})</p>
                <p><span className="text-muted-foreground">Progress:</span> {viewing.progress}%</p>
                <p><span className="text-muted-foreground">Status:</span> {viewing.status}</p>
                {viewing.status === "Deactivated" && viewing.deactivatedAt && (
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">Deactivated at:</span>{" "}
                    {new Date(viewing.deactivatedAt).toLocaleString()}
                  </p>
                )}
                {viewing.progressNote && (
                  <p className="sm:col-span-2"><span className="text-muted-foreground">Progress note:</span> {viewing.progressNote}</p>
                )}
                {!isTeacher && (
                  <p><span className="text-muted-foreground">Fees:</span> {inr(viewing.fees.paid)} / {inr(viewing.fees.total)}</p>
                )}
                {!isTeacher && (
                  <p className="sm:col-span-2 rounded-md border border-border/60 bg-muted/40 p-3 font-mono text-xs">
                    <span className="block text-[10px] font-sans uppercase tracking-wide text-muted-foreground">
                      Generated password
                      {(viewing as Student & { mustChangePassword?: boolean }).mustChangePassword
                        ? " (must change on first login)"
                        : ""}
                    </span>
                    {(viewing as Student & { provisionalPassword?: string }).provisionalPassword ||
                      "Not available — password was changed or never issued"}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
                {!isTeacher && <Button onClick={() => { setViewing(null); openEdit(viewing); }}>Edit</Button>}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!progressFor} onOpenChange={(o) => !o && setProgressFor(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Review progress — {progressFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Progress (%)</Label>
              <Input className="mt-1.5" type="number" min={0} max={100} value={progressValue} onChange={(e) => setProgressValue(e.target.value)} />
              <Progress className="mt-3 h-2" value={Number(progressValue) || 0} />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                className="mt-1.5"
                rows={3}
                value={progressNote}
                onChange={(e) => setProgressNote(e.target.value)}
                placeholder="Add context about the student's progress…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProgressFor(null)}>Cancel</Button>
            <Button disabled={!progressDirty} onClick={() => {
              if (!progressFor) return;
              const p = Math.min(100, Math.max(0, Number(progressValue) || 0));
              updateStudent(progressFor.id, {
                progress: p,
                progressNote: progressNote.trim() || undefined,
              });
              toast.success(`Updated progress for ${progressFor.name} to ${p}%`);
              setProgressFor(null);
            }}>Save progress</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

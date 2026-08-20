import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { BulkActions } from "@/components/dashboard/BulkActions";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { useDashboardData, type Assignment } from "@/components/dashboard/DashboardDataContext";
import { useTeacherScope } from "@/components/dashboard/useTeacherScope";
import { useStudentScope } from "@/components/dashboard/useStudentScope";
import { useAuth } from "@/components/dashboard/AuthContext";
import { requirePermission } from "@/lib/permission-guards";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormTabNav } from "@/components/dashboard/FormTabNav";
import { ClipboardList, CheckCircle2, Clock, Plus, ExternalLink, Upload, Eye, Loader2 } from "lucide-react";
import { paginate } from "@/lib/dashboard-utils";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { DateTimePickerField, buildDateTime, formatDueLabel } from "@/components/dashboard/DateTimePickerField";
import { SubmittedFileCard, SubmissionStatusBadge, submissionStatusLabel } from "@/components/dashboard/SubmittedFileCard";
import { fetchMissedStudents, fetchSubmittedStudents } from "@/lib/dashboard-api";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/dashboard/assignments")({
  beforeLoad: requirePermission("assignments.view"),
  component: AssignmentsPage,
});

const csvHeaders = ["title", "course", "batch", "due", "status"];

function StudentAssignments() {
  const { submitAssignment } = useDashboardData();
  const { myAssignments, openAssignments, mySubmissions, me, studentId } = useStudentScope();
  const [page, setPage] = useState(1);
  const [submitFor, setSubmitFor] = useState<Assignment | null>(null);
  const [reviewFor, setReviewFor] = useState<Assignment | null>(null);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const paged = paginate(myAssignments, page);

  const submissionFor = (a: Assignment) =>
    mySubmissions.find((s) => s.assignmentId === a._uuid || s.assignmentTitle === a.title);

  return (
    <>
      <PageHeader
        title="My Assignments"
        subtitle="Submit open assignments and review feedback once graded."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Assigned" value={myAssignments.length} icon={ClipboardList} tone="primary" />
        <StatCard label="Portal open" value={openAssignments.length} icon={Upload} tone="highlight" />
        <StatCard label="Submitted" value={mySubmissions.length} icon={CheckCircle2} tone="success" />
      </div>

      <Card className="mt-6 border-border/60">
        <CardContent className="p-4 sm:p-5">
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {paged.items.map((a) => {
              const sub = submissionFor(a);
              return (
                <Card key={a._uuid || a.title} className="border-border/60">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold">{a.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{a.course} · {a.batch}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Due {formatDueLabel(a.dueAt, a.due)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={a.portalOpen ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}>
                          {a.portalOpen ? "Portal open" : "Closed"}
                        </Badge>
                        {sub && <SubmissionStatusBadge status={sub.status} apiStatus={sub.apiStatus} />}
                      </div>
                    </div>
                    {sub ? (
                      <div className="mt-4">
                        <SubmittedFileCard
                          submissionId={sub.id}
                          fileName={sub.fileName}
                          fileUrl={sub.fileUrl}
                          fileType={sub.fileType}
                          fileSize={sub.fileSize}
                          submittedAt={sub.submittedAt}
                          statusLabel={submissionStatusLabel(sub.status, sub.apiStatus)}
                          emptyLabel="Submitted without a file"
                        />
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {a.portalOpen && !sub && (
                        <Button size="sm" className="btn-highlight" onClick={() => { setSubmitFor(a); setNotes(""); setFile(null); }}>
                          <Upload className="mr-1 h-3.5 w-3.5" /> Open portal & submit
                        </Button>
                      )}
                      {a.portalOpen && sub && sub.status === "submitted" && (
                        <Button size="sm" variant="outline" onClick={() => { setSubmitFor(a); setNotes(sub.notes); setFile(null); }}>
                          Resubmit
                        </Button>
                      )}
                      {sub && (
                        <Button size="sm" variant="outline" onClick={() => setReviewFor(a)}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> Review later
                        </Button>
                      )}
                      {!a.portalOpen && !sub && (
                        <p className="text-xs text-muted-foreground">Waiting for teacher to open the portal.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {myAssignments.length === 0 && (
              <p className="text-sm text-muted-foreground">No assignments for your batch yet.</p>
            )}
          </div>
          <DataPagination page={paged.page} totalPages={paged.totalPages} total={paged.total} from={paged.from} to={paged.to} onPageChange={setPage} />
        </CardContent>
      </Card>

      <Dialog open={!!submitFor} onOpenChange={(o) => !o && !submitting && setSubmitFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit — {submitFor?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {submitFor && submissionFor(submitFor)?.fileUrl ? (
              <div>
                <Label>Current submission</Label>
                <SubmittedFileCard
                  className="mt-1.5"
                  submissionId={submissionFor(submitFor)?.id}
                  fileName={submissionFor(submitFor)?.fileName}
                  fileUrl={submissionFor(submitFor)?.fileUrl}
                  fileType={submissionFor(submitFor)?.fileType}
                  fileSize={submissionFor(submitFor)?.fileSize}
                  submittedAt={submissionFor(submitFor)?.submittedAt}
                  statusLabel={submissionStatusLabel(submissionFor(submitFor)?.status, submissionFor(submitFor)?.apiStatus)}
                />
              </div>
            ) : null}
            <div>
              <Label>Notes</Label>
              <Textarea className="mt-1.5" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for your teacher" />
            </div>
            <div>
              <Label>File</Label>
              <Input
                className="mt-1.5"
                type="file"
                disabled={submitting}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Selected: {file.name}{file.size ? ` · ${(file.size / 1024).toFixed(1)} KB` : ""}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={submitting} onClick={() => setSubmitFor(null)}>Cancel</Button>
            <Button
              className="btn-highlight"
              disabled={submitting}
              onClick={async () => {
                if (!submitFor || !me) return;
                if (!file && !notes.trim()) {
                  toast.error("Add a file or notes");
                  return;
                }
                if (!submitFor._uuid) {
                  toast.error("Assignment is missing. Refresh and try again.");
                  return;
                }
                setSubmitting(true);
                const result = await submitAssignment({
                  assignmentTitle: submitFor.title,
                  assignmentId: submitFor._uuid,
                  studentId,
                  studentName: me.name,
                  notes: notes.trim(),
                  file: file || undefined,
                });
                setSubmitting(false);
                if (!result.ok) {
                  toast.error(result.detail || "Could not submit assignment");
                  return;
                }
                toast.success("Assignment submitted");
                setSubmitFor(null);
                setFile(null);
              }}
            >
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewFor} onOpenChange={(o) => !o && setReviewFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review — {reviewFor?.title}</DialogTitle></DialogHeader>
          {reviewFor && (() => {
            const sub = submissionFor(reviewFor);
            if (!sub) return <p className="text-sm text-muted-foreground">No submission yet.</p>;
            return (
              <div className="space-y-3 text-sm">
                <p><span className="text-muted-foreground">Status:</span> {submissionStatusLabel(sub.status, sub.apiStatus)}</p>
                <SubmittedFileCard
                  submissionId={sub.id}
                  fileName={sub.fileName}
                  fileUrl={sub.fileUrl}
                  fileType={sub.fileType}
                  fileSize={sub.fileSize}
                  submittedAt={sub.submittedAt}
                  emptyLabel="Submitted without a file"
                />
                <p><span className="text-muted-foreground">Notes:</span> {sub.notes || "—"}</p>
                {sub.status === "reviewed" && (
                  <>
                    <p><span className="text-muted-foreground">Score:</span> {sub.score}/100</p>
                    <p><span className="text-muted-foreground">Feedback:</span> {sub.feedback || "—"}</p>
                  </>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewFor(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TeacherAdminAssignments() {
  const { isTeacher, isAdmin } = useAuth();
  const { hasPermission, loading: permsLoading } = usePermissions();
  const data = useDashboardData();
  const scope = useTeacherScope();
  const assignments = isTeacher ? scope.myAssignments : data.assignments;
  const courses = isTeacher ? scope.myCourses : data.courses;
  const batches = isTeacher ? scope.myBatches : data.batches;
  const { students, addAssignment, updateAssignment, importAssignments, submissions, reviewSubmission } = data;
  const teacherName = scope.teacherName;

  const [page, setPage] = useState(1);
  const [review, setReview] = useState<Assignment | null>(null);
  const [reviewTab, setReviewTab] = useState<"review" | "missed">("review");
  const [studentId, setStudentId] = useState("");
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    course: "",
    batch: "",
    dueDate: undefined as Date | undefined,
    dueTime: "18:00",
    assignMode: "batch" as "one" | "batch",
    studentId: "",
    status: "Active" as Assignment["status"],
  });

  const canCreateAssignments = !permsLoading && hasPermission("assignments.create");
  const canUpdateAssignments = !permsLoading && hasPermission("assignments.update");
  const canGradeAssignments = !permsLoading && hasPermission("assignments.grade");
  const canExportAssignments = !permsLoading && hasPermission("assignments.export");

  const paged = paginate(assignments, page);

  const studentOptions = useMemo(() => {
    if (!form.course) return students;
    return students.filter((s) => s.course === form.course);
  }, [students, form.course]);

  const assignmentId = review?._uuid || "";
  const submittedStudentsQ = useQuery({
    queryKey: ["assignments", assignmentId, "submitted-students"],
    queryFn: () => fetchSubmittedStudents(assignmentId),
    enabled: Boolean(assignmentId),
  });
  const missedStudentsQ = useQuery({
    queryKey: ["assignments", assignmentId, "missed-students"],
    queryFn: () => fetchMissedStudents(assignmentId),
    enabled: Boolean(assignmentId),
  });

  const submittedStudents = useMemo(() => {
    const fromApi = (submittedStudentsQ.data || []).map((row) => {
      const match = students.find(
        (s) => s.id === row.id || s._uuid === row.id || s.id === row.name,
      );
      return {
        id: match?.id || row.id,
        uuid: match?._uuid || row.id,
        name: match?.name || row.name,
        submissionId: row.submissionId,
      };
    });
    const fromSubs = submissions
      .filter((s) => s.assignmentId === assignmentId || s.assignmentTitle === review?.title)
      .map((s) => {
        const match = students.find(
          (st) => st.id === s.studentId || st._uuid === s.studentUuid,
        );
        return {
          id: match?.id || s.studentId,
          uuid: match?._uuid || s.studentUuid || s.studentId,
          name: match?.name || s.studentName || s.studentId,
          submissionId: s.id,
        };
      });
    const merged = new Map<string, (typeof fromApi)[number]>();
    for (const row of [...fromSubs, ...fromApi]) {
      const key = row.uuid || row.id;
      const existing = merged.get(key);
      merged.set(key, {
        ...existing,
        ...row,
        submissionId: row.submissionId || existing?.submissionId,
        name: row.name || existing?.name,
      });
    }
    return [...merged.values()];
  }, [submittedStudentsQ.data, students, submissions, assignmentId, review?.title]);

  const missedStudents = useMemo(() => {
    return (missedStudentsQ.data || []).map((row) => {
      const match = students.find(
        (s) => s.id === row.id || s._uuid === row.id || s.id === row.name,
      );
      return {
        id: match?.id || row.id,
        name: match?.name || row.name,
      };
    });
  }, [missedStudentsQ.data, students]);

  const resolveTargets = () => {
    if (form.assignMode === "one") {
      const student = studentOptions.find((s) => s.id === form.studentId) || students.find((s) => s.id === form.studentId);
      if (!student) return null;
      return {
        batch: student.batch,
        total: 1,
        studentId: student.id,
      };
    }
    if (!form.batch) return null;
    const batchStudents = students.filter((s) => s.batch === form.batch);
    return {
      batch: form.batch,
      total: batchStudents.length || 1,
      studentId: undefined as string | undefined,
    };
  };

  const openAdd = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    setForm({
      title: "",
      course: courses[0]?.title || "",
      batch: batches[0]?.id || "",
      dueDate: tomorrow,
      dueTime: "18:00",
      assignMode: "batch",
      studentId: students[0]?.id || "",
      status: "Active",
    });
    setFormOpen(true);
  };

  const buildDueFields = () => {
    if (!form.dueDate || !form.dueTime) return null;
    const dueAt = buildDateTime(form.dueDate, form.dueTime).toISOString();
    return { dueAt, due: formatDueLabel(dueAt) };
  };

  const createAssignment = (portalOpen: boolean) => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return false;
    }
    if (!form.course) {
      toast.error("Select a course");
      return false;
    }
    const targets = resolveTargets();
    if (!targets) {
      toast.error(form.assignMode === "one" ? "Select a student" : "Select a batch");
      return false;
    }
    if (!targets.batch) {
      toast.error("Selected student has no batch");
      return false;
    }
    const dueFields = buildDueFields();
    if (!dueFields) {
      toast.error("Due date and time are required");
      return false;
    }
    addAssignment({
      title: form.title.trim(),
      course: form.course,
      batch: targets.batch,
      due: dueFields.due,
      dueAt: dueFields.dueAt,
      submissions: 0,
      total: targets.total,
      status: form.status,
      // Prefer course instructor so the assigned teacher receives the assignment
      teacher: isTeacher
        ? teacherName
        : courses.find((c) => c.title === form.course)?.instructor ||
          batches.find((b) => b.id === targets.batch)?.teacher ||
          teacherName,
      portalOpen,
      assignStudentId: targets.studentId,
    });
    return true;
  };

  const save = () => {
    if (!createAssignment(false)) return;
    toast.success(`Created ${form.title}`);
    setFormOpen(false);
  };

  const openPortal = (a: Assignment) => {
    updateAssignment(a.title, { portalOpen: true, status: a.status === "Completed" ? a.status : "Active" });
    toast.success("Submission portal opened for students");
  };

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle={isTeacher ? "Create and review assignments for your batches." : "Create, track and grade student submissions."}
        action={
          <div className="flex flex-wrap gap-2">
            <BulkActions
              entity="assignments"
              csvHeaders={csvHeaders}
              csvSampleRows={[]}
              showImport={isAdmin}
              showExport={canExportAssignments}
              exportHeaders={["Title", "Course", "Batch", "Due", "Submissions", "Status", "Portal"]}
              exportRows={assignments.map((a) => [a.title, a.course, a.batch, a.due, `${a.submissions}/${a.total}`, a.status, a.portalOpen ? "Open" : "Closed"])}
              onImport={isAdmin ? (rows) => toast.success(`Imported ${importAssignments(rows)} assignment(s)`) : undefined}
            />
            {canCreateAssignments ? (
              <Button size="sm" className="btn-highlight" onClick={openAdd}><Plus className="mr-1 h-4 w-4" /> New assignment</Button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Active" value={assignments.filter((a) => a.status === "Active").length} icon={ClipboardList} tone="primary" />
        <StatCard label="Grading" value={assignments.filter((a) => a.status === "Grading").length} icon={Clock} tone="highlight" />
        <StatCard label="Completed" value={assignments.filter((a) => a.status === "Completed").length} icon={CheckCircle2} tone="success" />
        <StatCard label="Submissions" value={assignments.reduce((n, a) => n + a.submissions, 0)} icon={ClipboardList} tone="info" />
      </div>
      <Card className="mt-6 border-border/60"><CardContent className="p-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assignment</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Submissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Portal</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.items.map((a) => (
              <TableRow key={a.title}>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell className="text-sm">{a.course}</TableCell>
                <TableCell className="text-sm">{a.batch}</TableCell>
                <TableCell className="text-sm">{formatDueLabel(a.dueAt, a.due)}</TableCell>
                <TableCell className="text-sm">{a.submissions} / {a.total}</TableCell>
                <TableCell>
                  <Badge className={
                    a.status === "Completed" ? "bg-success/15 text-success hover:bg-success/20"
                    : a.status === "Grading" ? "bg-highlight/20 text-[color:var(--highlight-foreground)]"
                    : "bg-primary/15 text-primary hover:bg-primary/20"
                  }>{a.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{a.portalOpen ? "Open" : "Closed"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {canUpdateAssignments ? (
                      <Button variant="outline" size="sm" onClick={() => openPortal(a)}>
                        <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open portal
                      </Button>
                    ) : null}
                    {canGradeAssignments ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReview(a);
                          setReviewTab("review");
                          setStudentId("");
                          setScore("");
                          setFeedback("");
                        }}
                      >
                        Review
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <DataPagination page={paged.page} totalPages={paged.totalPages} total={paged.total} from={paged.from} to={paged.to} onPageChange={setPage} />
      </CardContent></Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New assignment</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Title</Label><Input className="mt-1.5" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="React Todo App" /></div>
            <div>
              <Label>Course</Label>
              <Select
                value={form.course}
                onValueChange={(v) => {
                  const batch = batches.find((b) => b.course === v);
                  const courseStudents = students.filter((s) => s.course === v);
                  setForm({
                    ...form,
                    course: v,
                    batch: batch?.id || form.batch,
                    studentId: courseStudents[0]?.id || form.studentId,
                  });
                }}
              >
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>{courses.map((c) => <SelectItem key={c.slug} value={c.title}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assign to</Label>
              <Select
                value={form.assignMode}
                onValueChange={(v) => setForm({ ...form, assignMode: v as "one" | "batch" })}
              >
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one">One student</SelectItem>
                  <SelectItem value="batch">Entire batch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.assignMode === "one" ? (
              <div className="sm:col-span-2">
                <Label>Student</Label>
                <Select
                  value={form.studentId || undefined}
                  onValueChange={(v) => {
                    const student = students.find((s) => s.id === v);
                    setForm({
                      ...form,
                      studentId: v,
                      batch: student?.batch || form.batch,
                      course: student?.course || form.course,
                    });
                  }}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {studentOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.batch})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="sm:col-span-2">
                <Label>Batch</Label>
                <Select
                  value={form.batch}
                  onValueChange={(v) => setForm({ ...form, batch: v })}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent>
                    {batches
                      .filter((b) => !form.course || b.course === form.course)
                      .map((b) => <SelectItem key={b.id} value={b.id}>{b.id} — {b.course}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="sm:col-span-2">
              <DateTimePickerField
                date={form.dueDate}
                time={form.dueTime}
                onDateChange={(dueDate) => setForm({ ...form, dueDate })}
                onTimeChange={(dueTime) => setForm({ ...form, dueTime })}
                dateLabel="Due date"
                timeLabel="Due time"
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            {canCreateAssignments ? (
              <>
                <Button variant="secondary" onClick={save}>Create assignment</Button>
                {canUpdateAssignments ? (
                  <Button
                    className="btn-highlight"
                    onClick={() => {
                      if (!createAssignment(true)) return;
                      setFormOpen(false);
                      toast.success("Assignment created — portal open until due date/time");
                    }}
                  >
                    <ExternalLink className="mr-1 h-4 w-4" /> Create & open portal
                  </Button>
                ) : null}
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Review — {review?.title}</DialogTitle>
          </DialogHeader>
          <FormTabNav
            value={reviewTab}
            onChange={(id) => setReviewTab(id as "review" | "missed")}
            tabs={[
              { id: "review", label: "Review" },
              { id: "missed", label: "Missed" },
            ]}
          />
          {reviewTab === "review" ? (
            <>
              <div className="space-y-4">
                <div>
                  <Label>Student</Label>
                  <Select value={studentId} onValueChange={setStudentId}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select student by name" /></SelectTrigger>
                    <SelectContent>
                      {submittedStudents.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.id})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {submittedStudentsQ.isLoading ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading submitted students…
                    </p>
                  ) : submittedStudents.length === 0 ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">No submitted students for this assignment.</p>
                  ) : null}
                </div>
                {studentId && review && (
                  <div className="rounded-lg border border-border/60 p-3">
                    {(() => {
                      const selected = submittedStudents.find((s) => s.id === studentId);
                      const sub = submissions.find((s) =>
                        (s.assignmentId === review._uuid || s.assignmentTitle === review.title) &&
                        (
                          s.studentId === studentId ||
                          s.studentUuid === studentId ||
                          s.studentUuid === selected?.uuid ||
                          s.id === selected?.submissionId
                        ),
                      );
                      if (!sub) {
                        return <p className="text-xs text-muted-foreground">No file on record for this student yet — you can still grade.</p>;
                      }
                      return (
                        <div className="space-y-2">
                          <SubmittedFileCard
                            submissionId={sub.id}
                            fileName={sub.fileName}
                            fileUrl={sub.fileUrl}
                            fileType={sub.fileType}
                            fileSize={sub.fileSize}
                            submittedAt={sub.submittedAt}
                            statusLabel={submissionStatusLabel(sub.status, sub.apiStatus)}
                            emptyLabel="Student submitted without a file"
                          />
                          {sub.notes ? (
                            <p className="text-xs text-muted-foreground">Notes: {sub.notes}</p>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                )}
                <div>
                  <Label>Score (out of 100)</Label>
                  <Input className="mt-1.5" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} placeholder="85" />
                </div>
                <div>
                  <Label>Feedback</Label>
                  <Textarea className="mt-1.5" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Share feedback for the student…" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReview(null)}>Cancel</Button>
                <Button
                  disabled={!studentId || !score || !canGradeAssignments}
                  onClick={() => {
                    const selected = submittedStudents.find((s) => s.id === studentId);
                    const name = selected?.name;
                    if (review) {
                      updateAssignment(review.title, { status: "Grading", submissions: Math.min(review.total, review.submissions + 1) });
                      const sub = submissions.find((s) =>
                        (s.assignmentId === review._uuid || s.assignmentTitle === review.title) &&
                        (
                          s.studentId === studentId ||
                          s.studentUuid === studentId ||
                          s.studentUuid === selected?.uuid ||
                          s.id === selected?.submissionId
                        ),
                      );
                      if (sub) reviewSubmission(sub.id, Number(score), feedback);
                    }
                    toast.success(`Graded ${name} — ${score}/100`, { description: feedback || undefined });
                    setReview(null);
                  }}
                >
                  Submit review
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="min-h-[180px]">
              {missedStudentsQ.isLoading ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading missed students…
                </p>
              ) : missedStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No missed submissions</p>
              ) : (
                <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                  {missedStudents.map((s) => (
                    <li key={s.id} className="px-3 py-2.5 text-sm">
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AssignmentsPage() {
  const { isStudent } = useAuth();
  if (isStudent) return <StudentAssignments />;
  return <TeacherAdminAssignments />;
}

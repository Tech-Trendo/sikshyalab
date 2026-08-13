import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { DashboardSectionLinks } from "@/components/dashboard/DashboardSectionLinks";
import { BulkActions } from "@/components/dashboard/BulkActions";
import { useDashboardData, type BoardTask, TASK_STATUSES, type TaskStatus } from "@/components/dashboard/DashboardDataContext";
import { useAuth } from "@/components/dashboard/AuthContext";
import { useTeacherScope } from "@/components/dashboard/useTeacherScope";
import { useStudentScope } from "@/components/dashboard/useStudentScope";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerField } from "@/components/dashboard/DatePickerField";
import { format, parse, isValid } from "date-fns";
import { Kanban, Plus, Calendar, Pencil, Trash2, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/tasks")({
  component: TasksPage,
});

const csvHeaders = ["title", "course", "due", "status", "studentId", "studentName"];

function nextStatus(status: TaskStatus): TaskStatus | null {
  const i = TASK_STATUSES.indexOf(status);
  if (i < 0 || i >= TASK_STATUSES.length - 1) return null;
  return TASK_STATUSES[i + 1];
}

function TasksPage() {
  const { isTeacher, isStudent, isAdmin, user } = useAuth();
  const { tasks, students, courses, batches, addTask, updateTask, deleteTask, advanceTaskStatus, assignTasksToStudents, importTasks } = useDashboardData();
  const { myStudents, myCourses, teacherName } = useTeacherScope();
  const { myTasks, myCourses: studentCourses, me } = useStudentScope();

  const scopedTasks = useMemo(() => {
    if (isStudent) return myTasks;
    if (isTeacher) {
      const ids = new Set(myStudents.map((s) => s.id));
      return tasks.filter((t) => ids.has(t.studentId) || t.assignedBy === teacherName || t.createdByName === teacherName);
    }
    return tasks;
  }, [isStudent, isTeacher, myTasks, tasks, myStudents, teacherName]);

  const courseOptions = isStudent ? studentCourses : isTeacher ? myCourses : courses;
  const studentOptions = isTeacher ? myStudents : students;

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, BoardTask[]> = {
      "To Do": [],
      "In Progress": [],
      Submitted: [],
      Completed: [],
    };
    for (const t of scopedTasks) {
      map[t.status] = [...(map[t.status] || []), t];
    }
    return map;
  }, [scopedTasks]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BoardTask | null>(null);
  const [form, setForm] = useState({
    title: "",
    course: "",
    dueDate: undefined as Date | undefined,
    assignMode: "one" as "one" | "batch" | "self",
    studentId: "",
    batchId: "",
    batchIds: [] as string[],
  });

  const formatDue = (d?: Date) => (d ? format(d, "MMM d, yyyy") : "TBD");

  const parseDue = (due: string): Date | undefined => {
    if (!due || due === "TBD") return undefined;
    const d = parse(due, "MMM d, yyyy", new Date());
    return isValid(d) ? d : undefined;
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      title: "",
      course: courseOptions[0]?.title || "",
      dueDate: undefined,
      assignMode: isStudent ? "self" : "one",
      studentId: studentOptions[0]?.id || "",
      batchId: studentOptions[0]?.batch || "",
      batchIds: [],
    });
    setFormOpen(true);
  };

  const openEdit = (t: BoardTask) => {
    setEditing(t);
    setForm({
      title: t.title,
      course: t.course,
      dueDate: parseDue(t.due),
      assignMode: "one",
      studentId: t.studentId,
      batchId: "",
      batchIds: [],
    });
    setFormOpen(true);
  };

  const save = () => {
    if (!form.title.trim()) {
      toast.error("Task title is required");
      return;
    }
    if (!form.course) {
      toast.error("Select a course");
      return;
    }

    const due = formatDue(form.dueDate);

    if (editing) {
      updateTask(editing.id, { title: form.title.trim(), course: form.course, due });
      toast.success("Task updated");
      setFormOpen(false);
      return;
    }

    if (isStudent && me) {
      addTask({
        title: form.title.trim(),
        course: form.course,
        due,
        status: "To Do",
        studentId: me.id,
        studentName: me.name,
        createdByRole: "student",
        createdByName: user.name,
      });
      toast.success("Task added to your board");
      setFormOpen(false);
      return;
    }

    if (form.assignMode === "batch") {
      if (isAdmin && form.batchIds.length > 0) {
        const n = assignTasksToStudents({
          title: form.title.trim(),
          course: form.course,
          due,
          batchIds: form.batchIds,
          createdByName: user.name,
          createdByRole: "admin",
          assignedBy: user.name,
        });
        toast.success(`Assigned task to ${n} student(s) across ${form.batchIds.length} batch(es)`);
      } else {
        const batchStudents = studentOptions.filter((s) => s.batch === form.batchId);
        if (!batchStudents.length) {
          toast.error("No students in that batch");
          return;
        }
        const n = assignTasksToStudents({
          title: form.title.trim(),
          course: form.course,
          due,
          studentIds: batchStudents.map((s) => s.id),
          createdByName: user.name,
          createdByRole: isTeacher ? "teacher" : "admin",
          assignedBy: isTeacher ? teacherName : user.name,
        });
        toast.success(`Assigned task to ${n} student(s)`);
      }
    } else {
      const student = studentOptions.find((s) => s.id === form.studentId);
      if (!student) {
        toast.error("Select a student");
        return;
      }
      addTask({
        title: form.title.trim(),
        course: form.course,
        due,
        status: "To Do",
        studentId: student.id,
        studentName: student.name,
        createdByRole: isTeacher ? "teacher" : "admin",
        createdByName: user.name,
        assignedBy: isTeacher ? teacherName : user.name,
      });
      toast.success(`Assigned to ${student.name}`);
    }
    setFormOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Task Board"
        subtitle={
          isStudent
            ? "Move tasks forward only: To Do → In Progress → Submitted → Completed."
            : isTeacher
              ? "Create, edit, delete and assign tasks to your students."
              : "Organize learning tasks Kanban-style."
        }
        action={
          <div className="flex flex-wrap gap-2">
            {!isStudent && (
              <BulkActions
                entity="tasks"
                csvHeaders={csvHeaders}
                csvSampleRows={[]}
                showExport
                showImport={isAdmin}
                exportHeaders={["Title", "Course", "Due", "Status", "Student"]}
                exportRows={scopedTasks.map((t) => [t.title, t.course, t.due, t.status, t.studentName])}
                onImport={isAdmin ? (rows) => toast.success(`Imported ${importTasks(rows)} task(s)`) : undefined}
              />
            )}
            {!isStudent && (
              <Button size="sm" className="btn-highlight" onClick={openAdd}>
                <Plus className="mr-1 h-4 w-4" /> Assign task
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {TASK_STATUSES.map((name) => (
          <StatCard
            key={name}
            label={name}
            value={byStatus[name].length}
            icon={Kanban}
            tone={name === "Completed" ? "success" : name === "Submitted" ? "highlight" : name === "In Progress" ? "info" : "primary"}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((name) => (
          <div key={name} className="rounded-xl border border-border bg-secondary/40 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-sm font-semibold">{name}</p>
              <Badge variant="secondary">{byStatus[name].length}</Badge>
            </div>
            <div className="space-y-2">
              {byStatus[name].map((t) => {
                const nxt = nextStatus(t.status);
                return (
                  <Card key={t.id} className="border-border/60">
                    <CardContent className="p-3">
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{t.course}</p>
                      {!isStudent && (
                        <p className="mt-1 text-xs text-muted-foreground">{t.studentName}</p>
                      )}
                      {t.assignedBy && (
                        <p className="mt-1 text-[10px] text-muted-foreground">Assigned by {t.assignedBy}</p>
                      )}
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" /> {t.due}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {isStudent && nxt && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              if (advanceTaskStatus(t.id)) toast.success(`Moved to ${nxt}`);
                            }}
                          >
                            Mark {nxt} <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        )}
                        {(isTeacher || isAdmin) && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(isTeacher || isAdmin) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive"
                            onClick={() => {
                              deleteTask(t.id);
                              toast.success("Task deleted");
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {!isStudent && name === "To Do" && (
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground" onClick={openAdd}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Assign task
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{scopedTasks.length} tasks on board</p>
      <DashboardSectionLinks role={user.role} section="/dashboard/tasks" className="mt-4" />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit task" : isStudent ? "New task" : "Assign task"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Title</Label>
              <Input className="mt-1.5" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Course</Label>
              <Select value={form.course} onValueChange={(v) => setForm({ ...form, course: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {courseOptions.map((c) => (
                    <SelectItem key={c.slug} value={c.title}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due date</Label>
              <div className="mt-1.5">
                <DatePickerField
                  value={form.dueDate}
                  onChange={(dueDate) => setForm({ ...form, dueDate })}
                  placeholder="Select due date"
                />
              </div>
            </div>
            {!isStudent && !editing && (
              <>
                <div>
                  <Label>Assign to</Label>
                  <Select value={form.assignMode} onValueChange={(v) => setForm({ ...form, assignMode: v as "one" | "batch" })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one">One student</SelectItem>
                      <SelectItem value="batch">Entire batch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.assignMode === "one" ? (
                  <div>
                    <Label>Student</Label>
                    <Select value={form.studentId} onValueChange={(v) => setForm({ ...form, studentId: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {studentOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name} ({s.batch})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : isAdmin ? (
                  <div>
                    <Label>Batches (select one or more)</Label>
                    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                      {batches.map((b) => (
                        <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            id={`task-batch-${b.id}`}
                            name="batchIds"
                            type="checkbox"
                            value={b.id}
                            className="rounded border-border"
                            checked={form.batchIds.includes(b.id)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...form.batchIds, b.id]
                                : form.batchIds.filter((id) => id !== b.id);
                              setForm({ ...form, batchIds: next });
                            }}
                          />
                          <span>{b.id} — {b.course}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label>Batch</Label>
                    <Select value={form.batchId} onValueChange={(v) => setForm({ ...form, batchId: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[...new Set(studentOptions.map((s) => s.batch))].map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save changes" : isStudent ? "Add task" : "Assign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

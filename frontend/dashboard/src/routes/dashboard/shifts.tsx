import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { BulkActions } from "@/components/dashboard/BulkActions";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { useDashboardData, type Shift } from "@/components/dashboard/DashboardDataContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, BookOpen, Users, GraduationCap, Plus } from "lucide-react";
import { paginate } from "@/lib/dashboard-utils";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const csvHeaders = ["id", "course", "batch", "teacher", "startTime", "endTime", "days"];

export const Route = createFileRoute("/dashboard/shifts")({
  component: ShiftsPage,
});

function formatTimeRange(start: string, end: string) {
  return `${start} – ${end}`;
}

function ShiftsPage() {
  const { shifts, courses, batches, teachers, addShift, updateShift, importShifts } = useDashboardData();
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [form, setForm] = useState({
    id: "",
    course: "",
    batch: "",
    teacher: "",
    startTime: "09:00",
    endTime: "12:00",
    days: "Mon–Fri",
  });
  const paged = paginate(shifts, page);

  const batchOptions = useMemo(
    () => batches.filter((b) => !form.course || b.course === form.course),
    [batches, form.course],
  );

  const openAdd = () => {
    setEditing(null);
    setForm({
      id: `SH-${String(shifts.length + 1).padStart(3, "0")}`,
      course: courses[0]?.title || "",
      batch: batches[0]?.id || "",
      teacher: teachers[0]?.name || "",
      startTime: "09:00",
      endTime: "12:00",
      days: "Mon–Fri",
    });
    setFormOpen(true);
  };

  const openEdit = (s: Shift) => {
    setEditing(s);
    setForm({
      id: s.id,
      course: s.course,
      batch: s.batch,
      teacher: s.teacher,
      startTime: s.startTime,
      endTime: s.endTime,
      days: s.days,
    });
    setFormOpen(true);
  };

  const onCourseChange = (course: string) => {
    const match = batches.find((b) => b.course === course);
    setForm({
      ...form,
      course,
      batch: match?.id || "",
      teacher: match?.teacher || form.teacher,
    });
  };

  const onBatchChange = (batchId: string) => {
    const match = batches.find((b) => b.id === batchId);
    setForm({
      ...form,
      batch: batchId,
      course: match?.course || form.course,
      teacher: match?.teacher || form.teacher,
    });
  };

  const save = () => {
    if (!form.course || !form.batch || !form.teacher) {
      toast.error("Select course, batch and teacher");
      return;
    }
    if (!form.startTime || !form.endTime) {
      toast.error("Start and end time are required");
      return;
    }
    const payload: Shift = {
      id: form.id,
      course: form.course,
      batch: form.batch,
      teacher: form.teacher,
      startTime: form.startTime,
      endTime: form.endTime,
      days: form.days,
    };
    if (editing) {
      updateShift(editing.id, payload);
      toast.success("Shift updated");
    } else {
      if (shifts.some((s) => s.id === form.id)) {
        toast.error("Shift ID already exists");
        return;
      }
      addShift(payload);
      toast.success("Shift created");
    }
    setFormOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Shifts"
        subtitle="See which course and batch runs in each shift with the assigned teacher."
        action={
          <div className="flex flex-wrap gap-2">
            <BulkActions
              entity="shifts"
              csvHeaders={csvHeaders}
              csvSampleRows={[]}
              showExport
              exportHeaders={["Course", "Batch", "Teacher", "Start", "End", "Days"]}
              exportRows={shifts.map((s) => [s.course, s.batch, s.teacher, s.startTime, s.endTime, s.days])}
              onImport={(rows) => toast.success(`Imported ${importShifts(rows)} shift(s)`)}
            />
            <Button size="sm" className="btn-highlight" onClick={openAdd}><Plus className="mr-1 h-4 w-4" /> New shift</Button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Scheduled shifts" value={shifts.length} icon={Clock} tone="primary" />
        <StatCard label="Courses covered" value={new Set(shifts.map((s) => s.course)).size} icon={BookOpen} tone="info" />
        <StatCard label="Batches scheduled" value={new Set(shifts.map((s) => s.batch)).size} icon={Users} tone="highlight" />
        <StatCard label="Teachers assigned" value={new Set(shifts.map((s) => s.teacher)).size} icon={GraduationCap} tone="success" />
      </div>

      <Card className="mt-6 border-border/60">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Shift time</TableHead>
                <TableHead>Days</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.course}</TableCell>
                  <TableCell>{s.batch}</TableCell>
                  <TableCell>{s.teacher}</TableCell>
                  <TableCell>{formatTimeRange(s.startTime, s.endTime)}</TableCell>
                  <TableCell className="text-muted-foreground">{s.days}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)}>Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
              {shifts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">No shifts scheduled yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="p-4">
            <DataPagination page={paged.page} totalPages={paged.totalPages} total={paged.total} from={paged.from} to={paged.to} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit shift" : "New shift"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Course</Label>
              <Select value={form.course} onValueChange={onCourseChange}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.slug} value={c.title}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Batch</Label>
              <Select value={form.batch} onValueChange={onBatchChange}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select batch" /></SelectTrigger>
                <SelectContent>
                  {batchOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.id} — {b.course}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Teacher</Label>
              <Select value={form.teacher} onValueChange={(v) => setForm({ ...form, teacher: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start time</Label>
              <Input className="mt-1.5" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div>
              <Label>End time</Label>
              <Input className="mt-1.5" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Working days</Label>
              <Input className="mt-1.5" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} placeholder="Mon–Fri" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save changes" : "Create shift"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

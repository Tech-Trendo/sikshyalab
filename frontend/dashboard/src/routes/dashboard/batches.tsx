import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard, ResponsiveTable } from "@/components/dashboard/DashboardLayout";
import { BulkActions } from "@/components/dashboard/BulkActions";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { useDashboardData, type Batch } from "@/components/dashboard/DashboardDataContext";
import { useTeacherScope } from "@/components/dashboard/useTeacherScope";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Users, PlayCircle, Plus, Calendar } from "lucide-react";
import { paginate } from "@/lib/dashboard-utils";
import { useState } from "react";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { DatePickerField } from "@/components/dashboard/DatePickerField";
import { useDirtyForm } from "@/hooks/useDirtyForm";
import { requirePermission } from "@/lib/permission-guards";

const SHIFT_LABELS = ["Morning", "Daytime", "Evening", "Weekend"] as const;

function parseStartDate(value: string): Date | undefined {
  if (!value || value === "TBD") return undefined;
  const formats = ["MMM d, yyyy", "yyyy-MM-dd"];
  for (const f of formats) {
    const d = parse(value, f, new Date());
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

export const Route = createFileRoute("/dashboard/batches")({
  beforeLoad: requirePermission("batches.view"),
  component: BatchesPage,
});

const csvHeaders = ["id", "course", "teacher", "shift", "capacity", "start", "status"];

function BatchesPage() {
  const { courses, teachers, addBatch, updateBatch, importBatches } = useDashboardData();
  const { isTeacher, myBatches } = useTeacherScope();
  const batches = myBatches;
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [form, setForm] = useState({
    id: "", course: "", teacher: "", shift: "Evening", capacity: "30", enrolled: "0", startDate: undefined as Date | undefined, status: "Upcoming" as Batch["status"],
  });
  const [formBaseline, setFormBaseline] = useState<typeof form | null>(null);
  const paged = paginate(batches, page);
  const batchDirty = useDirtyForm(form, formBaseline, Boolean(editing));

  const openAdd = () => {
    setEditing(null);
    setFormBaseline(null);
    const prefix = "B-2026";
    const maxSeq = batches.reduce((max, b) => {
      if (!b.id?.startsWith(prefix)) return max;
      const raw = b.id.slice(prefix.length);
      const n = Number(raw);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    setForm({
      id: `${prefix}${String(maxSeq + 1).padStart(2, "0")}`,
      course: courses[0]?.title || "",
      teacher: teachers[0]?.name || "",
      shift: SHIFT_LABELS[2],
      capacity: "30",
      enrolled: "0",
      startDate: undefined,
      status: "Upcoming",
    });
    setFormOpen(true);
  };

  const openEdit = (b: Batch) => {
    setEditing(b);
    const next = {
      id: b.id,
      course: b.course,
      teacher: b.teacher,
      shift: b.shift,
      capacity: String(b.capacity),
      enrolled: String(b.enrolled),
      startDate: parseStartDate(b.start),
      status: b.status as Batch["status"],
    };
    setForm(next);
    setFormBaseline(next);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.id.trim() || !form.course.trim()) {
      toast.error("Batch ID and course are required");
      return;
    }
    const payload: Batch = {
      id: form.id,
      course: form.course,
      teacher: form.teacher,
      shift: form.shift,
      capacity: Number(form.capacity) || 30,
      enrolled: Number(form.enrolled) || 0,
      start: form.startDate ? format(form.startDate, "MMM d, yyyy") : "TBD",
      status: form.status,
    };
    if (editing) {
      updateBatch(editing.id, payload);
      toast.success(`Updated ${form.id}`);
      setFormOpen(false);
      return;
    }
    if (batches.some((b) => b.id === form.id)) {
      toast.error("Batch ID already exists");
      return;
    }
    const ok = await addBatch(payload);
    if (ok) {
      toast.success(`Created ${form.id}`);
      setFormOpen(false);
    } else {
      toast.error("Batch saved locally but could not sync to API — check course/teacher and try again");
    }
  };

  return (
    <>
      <PageHeader
        title="Batches"
        subtitle={isTeacher ? "Batches assigned to you — start dates only." : "Assign teachers, capacity and schedules."}
        action={
          <div className="flex flex-wrap gap-2">
            <BulkActions
              entity="batches"
              csvHeaders={csvHeaders}
              csvSampleRows={[]}
              showImport={!isTeacher}
              showExport={!isTeacher}
              exportHeaders={isTeacher ? ["Batch", "Course", "Start date", "Status"] : ["Batch", "Course", "Teacher", "Shift", "Enrolled", "Capacity", "Start", "Status"]}
              exportRows={
                isTeacher
                  ? batches.map((b) => [b.id, b.course, b.start, b.status])
                  : batches.map((b) => [b.id, b.course, b.teacher, b.shift, b.enrolled, b.capacity, b.start, b.status])
              }
              onImport={!isTeacher ? (rows) => toast.success(`Imported ${importBatches(rows)} batch(es)`) : undefined}
            />
            {!isTeacher && (
              <Button size="sm" className="btn-highlight" onClick={openAdd}><Plus className="mr-1 h-4 w-4" /> Create batch</Button>
            )}
          </div>
        }
      />

      {isTeacher ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Assigned batches" value={batches.length} icon={Layers} tone="primary" />
            <StatCard label="Ongoing" value={batches.filter((b) => b.status === "Ongoing").length} icon={PlayCircle} tone="success" />
            <StatCard label="Upcoming" value={batches.filter((b) => b.status === "Upcoming").length} icon={Calendar} tone="info" />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paged.items.map((b) => (
              <Card key={b.id} className="border-border/60">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{b.id}</Badge>
                    <Badge className={b.status === "Ongoing" ? "bg-success/15 text-success" : "bg-info/15 text-info"}>{b.status}</Badge>
                  </div>
                  <p className="mt-3 text-base font-semibold">{b.course}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" /> Starts {b.start}
                  </p>
                </CardContent>
              </Card>
            ))}
            {batches.length === 0 && <p className="text-sm text-muted-foreground">No batches assigned to you.</p>}
          </div>
          <DataPagination page={paged.page} totalPages={paged.totalPages} total={paged.total} from={paged.from} to={paged.to} onPageChange={setPage} />
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Total batches" value={batches.length} icon={Layers} tone="primary" />
            <StatCard label="Ongoing" value={batches.filter((b) => b.status === "Ongoing").length} icon={PlayCircle} tone="success" />
            <StatCard label="Upcoming" value={batches.filter((b) => b.status === "Upcoming").length} icon={Plus} tone="info" />
            <StatCard label="Total enrolled" value={batches.reduce((n, b) => n + b.enrolled, 0)} icon={Users} tone="highlight" />
          </div>
          <Card className="mt-6 border-border/60"><CardContent className="p-4 sm:p-5">
            <ResponsiveTable
              mobile={paged.items.map((b) => (
                <Card key={b.id} className="border-border/60">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{b.id}</p>
                        <p className="text-sm text-muted-foreground">{b.course}</p>
                      </div>
                      <Badge className={b.status === "Ongoing" ? "bg-success/15 text-success" : "bg-info/15 text-info"}>{b.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Teacher: {b.teacher} · {b.shift}</p>
                    <p className="text-xs text-muted-foreground">Capacity: {b.enrolled}/{b.capacity} · Starts {b.start}</p>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => openEdit(b)}>Edit</Button>
                  </CardContent>
                </Card>
              ))}
            >
            <Table>
              <TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Course</TableHead><TableHead>Teacher</TableHead><TableHead>Shift</TableHead><TableHead>Capacity</TableHead><TableHead>Start</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {paged.items.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.id}</TableCell>
                    <TableCell className="text-sm">{b.course}</TableCell>
                    <TableCell className="text-sm">{b.teacher}</TableCell>
                    <TableCell><Badge variant="secondary">{b.shift}</Badge></TableCell>
                    <TableCell className="text-sm">{b.enrolled} / {b.capacity}</TableCell>
                    <TableCell className="text-sm">{b.start}</TableCell>
                    <TableCell><Badge className={b.status === "Ongoing" ? "bg-success/15 text-success hover:bg-success/20" : "bg-info/15 text-info hover:bg-info/20"}>{b.status}</Badge></TableCell>
                    <TableCell><Button variant="outline" size="sm" onClick={() => openEdit(b)}>Edit</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </ResponsiveTable>
            <DataPagination page={paged.page} totalPages={paged.totalPages} total={paged.total} from={paged.from} to={paged.to} onPageChange={setPage} />
          </CardContent></Card>

          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Edit batch" : "Create batch"}</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Batch ID</Label><Input className="mt-1.5" value={form.id} disabled={!!editing} onChange={(e) => setForm({ ...form, id: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Batch["status"] })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Upcoming">Upcoming</SelectItem>
                      <SelectItem value="Ongoing">Ongoing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Course</Label>
                  <Select value={form.course} onValueChange={(v) => setForm({ ...form, course: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{courses.map((c) => <SelectItem key={c.slug} value={c.title}>{c.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Teacher</Label>
                  <Select value={form.teacher} onValueChange={(v) => setForm({ ...form, teacher: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{teachers.map((t) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Shift</Label>
                  <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{SHIFT_LABELS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Capacity</Label><Input className="mt-1.5" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
                <div><Label>Enrolled</Label><Input className="mt-1.5" type="number" value={form.enrolled} onChange={(e) => setForm({ ...form, enrolled: e.target.value })} /></div>
                <div className="sm:col-span-2">
                  <Label>Start date</Label>
                  <div className="mt-1.5">
                    <DatePickerField
                      value={form.startDate}
                      onChange={(startDate) => setForm({ ...form, startDate })}
                      placeholder="Select start date"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
                <Button disabled={Boolean(editing && !batchDirty)} onClick={() => void save()}>{editing ? "Save changes" : "Create batch"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}

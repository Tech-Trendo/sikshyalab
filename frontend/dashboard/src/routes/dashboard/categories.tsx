import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { useDashboardData } from "@/components/dashboard/DashboardDataContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FolderTree, Plus, Pencil, Trash2, BookOpen, Layers } from "lucide-react";
import { paginate } from "@/lib/dashboard-utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { courseEndpoints } from "@/lib/api-endpoints";
import {
  apiList,
  apiMutate,
  apiMutateDetailed,
  type ApiCategoryRow,
} from "@/lib/dashboard-api";

export const Route = createFileRoute("/dashboard/categories")({
  component: CategoriesPage,
});

const emptyForm = {
  name: "",
  is_active: true,
};

function CategoriesPage() {
  const { courses, replaceCourseCategories } = useDashboardData();
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApiCategoryRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ApiCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await apiList<ApiCategoryRow>(courseEndpoints.categories());
      setRows(list);
      replaceCourseCategories(
        list.map((c) => ({ id: String(c.id), name: c.name, slug: c.slug })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const paged = paginate(rows, page);
  const activeCount = rows.filter((r) => r.is_active !== false).length;

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (row: ApiCategoryRow) => {
    setEditing(row);
    setForm({
      name: row.name,
      is_active: row.is_active !== false,
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Category name is required");
      return;
    }
    setBusy(true);
    const body = {
      name: form.name.trim(),
      is_active: form.is_active,
    };
    try {
      if (editing?.slug) {
        const res = await apiMutateDetailed(
          courseEndpoints.categoryDetail(editing.slug),
          "PATCH",
          body,
        );
        if (res.status >= 200 && res.status < 300) {
          toast.success(`Updated ${form.name}`);
          setFormOpen(false);
          await load();
        } else {
          toast.error(res.error || "Could not update category");
        }
      } else {
        const created = await apiMutate<ApiCategoryRow>(courseEndpoints.categories(), "POST", body);
        if (created?.id) {
          toast.success(`Created ${form.name}`);
          setFormOpen(false);
          await load();
        } else {
          toast.error("Could not create category");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: ApiCategoryRow) => {
    if (!confirm(`Delete category "${row.name}"? Courses keep their other categories.`)) return;
    const res = await apiMutateDetailed(courseEndpoints.categoryDetail(row.slug), "DELETE");
    if (res.status >= 200 && res.status < 300) {
      toast.success(`Deleted ${row.name}`);
      await load();
    } else {
      toast.error(res.error || "Could not delete category");
    }
  };

  const courseCountFor = (name: string) =>
    courses.filter((c) => (c.categories?.length ? c.categories : [c.category]).includes(name)).length;

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Create and manage course categories. Courses can belong to multiple categories."
        action={
          <Button size="sm" className="btn-highlight" onClick={openAdd}>
            <Plus className="mr-1 h-4 w-4" /> New category
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Categories" value={rows.length} icon={FolderTree} tone="primary" />
        <StatCard label="Active" value={activeCount} icon={Layers} tone="success" />
        <StatCard label="Courses linked" value={courses.length} icon={BookOpen} tone="info" />
      </div>

      <Card className="mt-6 border-border/60">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.course_count ?? courseCountFor(row.name)}</TableCell>
                  <TableCell>
                    <Badge variant={row.is_active === false ? "outline" : "secondary"}>
                      {row.is_active === false ? "Inactive" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => void remove(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    No categories yet. Create one to assign courses.
                  </TableCell>
                </TableRow>
              )}
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    Loading categories…
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="p-4">
            <DataPagination
              page={paged.page}
              totalPages={paged.totalPages}
              total={paged.total}
              from={paged.from}
              to={paged.to}
              onPageChange={setPage}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Name</Label>
              <Input
                className="mt-1.5"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Web Development"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <Label htmlFor="cat-active">Active</Label>
              <Switch
                id="cat-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Loader2, Plus } from "lucide-react";
import { paginate, slugify } from "@/lib/dashboard-utils";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cmsApi, cmsKeys, type CmsCareer } from "@/lib/cms-api";

export const Route = createFileRoute("/dashboard/careers")({
  component: CareersAdminPage,
});

const EMPLOYMENT = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "REMOTE", label: "Remote" },
] as const;

function CareersAdminPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: cmsKeys.careers,
    queryFn: () => cmsApi.listCareers(),
  });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CmsCareer | null>(null);
  const [form, setForm] = useState({
    title: "",
    department: "",
    location: "",
    employment_type: "FULL_TIME",
    description: "",
    requirements: "",
  });

  const paged = useMemo(() => paginate(items, page), [items, page]);

  const resetForm = () =>
    setForm({
      title: "",
      department: "",
      location: "",
      employment_type: "FULL_TIME",
      description: "",
      requirements: "",
    });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        department: form.department.trim(),
        location: form.location.trim(),
        employment_type: form.employment_type,
        description: form.description.trim(),
        requirements: form.requirements.trim(),
        is_active: true,
        is_published: true,
      };
      if (edit) {
        return cmsApi.updateCareer(edit.slug, payload);
      }
      return cmsApi.createCareer({
        ...payload,
        slug: slugify(form.title) || `role-${Date.now()}`,
      });
    },
    onSuccess: (row) => {
      if (!row) {
        toast.error("Could not save role");
        return;
      }
      toast.success(edit ? "Role updated" : "Role published");
      setOpen(false);
      setEdit(null);
      resetForm();
      void qc.invalidateQueries({ queryKey: cmsKeys.careers });
    },
  });

  const toggle = async (c: CmsCareer) => {
    const ok = await cmsApi.updateCareer(c.slug, {
      is_published: !c.is_published,
      is_active: !c.is_published,
    });
    if (ok) {
      toast.success(c.is_published ? "Unpublished" : "Published");
      void qc.invalidateQueries({ queryKey: cmsKeys.careers });
    }
  };

  return (
    <>
      <PageHeader
        title="Careers"
        subtitle="Open roles shown on the public Career Services page."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label="Open roles" value={items.length} icon={Briefcase} tone="primary" />
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          className="btn-highlight"
          onClick={() => {
            setEdit(null);
            resetForm();
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add role
        </Button>
      </div>

      {isLoading && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing careers…
        </p>
      )}

      <div className="mt-6 space-y-3">
        {paged.items.map((c) => (
          <Card key={c.slug} className="border-border/60">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-sm font-semibold">{c.title}</p>
                <p className="text-xs text-muted-foreground">
                  {c.employment_type || "—"} · {c.location || "Remote"} ·{" "}
                  {c.department || "General"} · {c.is_published ? "Published" : "Draft"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEdit(c);
                    setForm({
                      title: c.title,
                      department: c.department || "",
                      location: c.location || "",
                      employment_type: c.employment_type || "FULL_TIME",
                      description: c.description || "",
                      requirements: c.requirements || "",
                    });
                    setOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => void toggle(c)}>
                  {c.is_published ? "Unpublish" : "Publish"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataPagination
        page={paged.page}
        totalPages={paged.totalPages}
        total={paged.total}
        from={paged.from}
        to={paged.to}
        onPageChange={setPage}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit ? "Edit role" : "New role"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Title</Label>
              <Input
                className="mt-1.5"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Department</Label>
                <Input
                  className="mt-1.5"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  className="mt-1.5"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Employment type</Label>
              <Select
                value={form.employment_type}
                onValueChange={(v) => setForm({ ...form, employment_type: v })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                className="mt-1.5"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Requirements</Label>
              <Textarea
                className="mt-1.5"
                rows={3}
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="btn-highlight"
              disabled={saveMut.isPending || !form.title.trim() || !form.description.trim()}
              onClick={() => void saveMut.mutateAsync()}
            >
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

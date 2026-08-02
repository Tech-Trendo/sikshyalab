import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import {
  useCreateTestimonialMutation,
  useTestimonialsQuery,
  useUpdateTestimonialMutation,
} from "@/hooks/useCmsQueries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus } from "lucide-react";
import { paginate } from "@/lib/dashboard-utils";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { CmsTestimonial } from "@/lib/cms-api";
import { Rating } from "@/components/ui/Rating";

export const Route = createFileRoute("/dashboard/testimonials")({
  component: TestimonialsPage,
});

const emptyForm = {
  name: "",
  role: "",
  organization: "",
  content: "",
  rating: 5,
  is_featured: false,
  is_published: true,
};

function TestimonialsPage() {
  const { data: testimonials = [], isLoading } = useTestimonialsQuery();
  const update = useUpdateTestimonialMutation();
  const create = useCreateTestimonialMutation();
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<CmsTestimonial | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const paged = useMemo(() => paginate(testimonials, page), [testimonials, page]);

  const save = () => {
    if (!edit) return;
    void update
      .mutateAsync({
        id: edit.id,
        patch: {
          name: edit.name,
          role: edit.role,
          organization: edit.organization,
          content: edit.content,
          rating: edit.rating,
          is_featured: edit.is_featured,
          is_published: edit.is_published,
        },
      })
      .then((res) => {
        if (res) {
          toast.success("Testimonial updated");
          setEdit(null);
        } else toast.error("Could not update testimonial");
      });
  };

  const createTestimonial = () => {
    if (!form.name.trim() || !form.content.trim()) {
      toast.error("Name and quote are required");
      return;
    }
    void create
      .mutateAsync({
        name: form.name.trim(),
        role: form.role.trim(),
        organization: form.organization.trim(),
        content: form.content.trim(),
        rating: form.rating,
        is_featured: form.is_featured,
        is_published: form.is_published,
      })
      .then((res) => {
        if (res) {
          toast.success("Testimonial added");
          setCreateOpen(false);
          setForm(emptyForm);
        } else toast.error("Could not create testimonial");
      });
  };

  return (
    <>
      <PageHeader
        title="Testimonials management"
        subtitle="Published quotes shown on the website. Promote student reviews from Review management."
        action={
          <Button
            size="sm"
            className="btn-highlight"
            onClick={() => {
              setForm(emptyForm);
              setCreateOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Add testimonial
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paged.items.map((t) => (
              <Card
                key={String(t.id)}
                className="h-[240px] rounded-[12px] border-border/60 shadow-[0_10px_40px_rgba(0,0,0,0.06)]"
              >
                <CardContent className="flex h-full flex-col p-7">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Rating value={t.rating} size="sm" emptyLabel="Unrated" />
                    <div className="flex gap-1">
                      {t.is_featured && <Badge className="bg-primary/10 text-primary">Featured</Badge>}
                      {!t.is_published && <Badge variant="secondary">Draft</Badge>}
                      {t.source_review_id && <Badge variant="outline">From review</Badge>}
                    </div>
                  </div>
                  <p className="min-h-0 flex-1 overflow-hidden text-sm leading-relaxed text-foreground/90 line-clamp-4">
                    "{t.content}"
                  </p>
                  <p className="mt-3 text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.role}
                    {t.organization ? ` · ${t.organization}` : ""}
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setEdit(t)}>
                    Edit
                  </Button>
                </CardContent>
              </Card>
            ))}
            {testimonials.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">
                No testimonials yet. Click “Add testimonial”, or promote a student review from Review management.
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
        </>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit testimonial</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div><Label>Name</Label><Input className="mt-1.5" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div><Label>Role</Label><Input className="mt-1.5" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} /></div>
              <div><Label>Organization</Label><Input className="mt-1.5" value={edit.organization} onChange={(e) => setEdit({ ...edit, organization: e.target.value })} /></div>
              <div><Label>Quote</Label><Textarea className="mt-1.5" rows={4} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} /></div>
              <div>
                <Label>Rating</Label>
                <div className="mt-2">
                  <Rating
                    value={edit.rating || null}
                    interactive
                    size="md"
                    emptyLabel=""
                    onChange={(n) => setEdit({ ...edit, rating: n })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Published on website</Label>
                <Switch checked={edit.is_published} onCheckedChange={(v) => setEdit({ ...edit, is_published: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Featured</Label>
                <Switch checked={edit.is_featured} onCheckedChange={(v) => setEdit({ ...edit, is_featured: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save} disabled={update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add testimonial</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name</Label><Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Role</Label><Input className="mt-1.5" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Student / Alumni" /></div>
            <div><Label>Organization</Label><Input className="mt-1.5" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} placeholder="College or company" /></div>
            <div><Label>Quote</Label><Textarea className="mt-1.5" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
            <div>
              <Label>Rating</Label>
              <div className="mt-2">
                <Rating
                  value={form.rating}
                  interactive
                  size="md"
                  emptyLabel=""
                  onChange={(n) => setForm({ ...form, rating: n })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Published on website</Label>
              <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Featured</Label>
              <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button className="btn-highlight" disabled={create.isPending} onClick={createTestimonial}>
              {create.isPending ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

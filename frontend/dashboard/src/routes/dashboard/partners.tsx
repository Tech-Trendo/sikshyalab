import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { MediaImagePicker } from "@/components/dashboard/MediaImagePicker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Handshake, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { paginate } from "@/lib/dashboard-utils";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cmsApi, cmsKeys, type CmsPartner } from "@/lib/cms-api";

export const Route = createFileRoute("/dashboard/partners")({
  component: PartnersAdminPage,
});

function PartnersAdminPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: cmsKeys.partners,
    queryFn: () => cmsApi.listPartners(),
  });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [preview, setPreview] = useState("");

  const paged = useMemo(() => paginate(items, page), [items, page]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!imageFile) throw new Error("Logo required");
      if (!name.trim()) throw new Error("Partner name is required");
      const form = new FormData();
      form.append("name", name.trim());
      if (website.trim()) form.append("website_url", website.trim());
      form.append("is_published", "true");
      form.append("logo", imageFile);
      const result = await cmsApi.createPartnerForm(form);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (row) => {
      toast.success("Partner published — logo appears on the homepage");
      setOpen(false);
      setName("");
      setWebsite("");
      setImageFile(undefined);
      setPreview("");
      qc.setQueryData<CmsPartner[]>(cmsKeys.partners, (prev = []) => {
        const without = prev.filter((p) => String(p.id) !== String(row.id));
        return [row, ...without];
      });
      void qc.invalidateQueries({ queryKey: cmsKeys.partners });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not upload partner logo");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string | number) => cmsApi.deletePartner(id),
    onSuccess: () => {
      toast.success("Partner removed");
      void qc.invalidateQueries({ queryKey: cmsKeys.partners });
    },
  });

  const togglePublish = async (item: CmsPartner) => {
    const ok = await cmsApi.updatePartner(item.id, {
      is_published: !item.is_published,
    });
    if (ok) {
      toast.success(item.is_published ? "Unpublished" : "Published");
      void qc.invalidateQueries({ queryKey: cmsKeys.partners });
    } else toast.error("Update failed");
  };

  return (
    <>
      <PageHeader
        title="Partners"
        subtitle="Partner logos shown on the public homepage. Only the logo is displayed on the site."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label="Partners" value={items.length} icon={Handshake} tone="primary" />
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          className="btn-highlight"
          onClick={() => {
            setOpen(true);
            setName("");
            setWebsite("");
            setImageFile(undefined);
            setPreview("");
          }}
        >
          <ImagePlus className="mr-1 h-4 w-4" /> Add partner
        </Button>
      </div>

      {isLoading && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing partners…
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paged.items.map((p) => (
          <Card key={String(p.id)} className="border-border/60 overflow-hidden">
            <div className="flex h-36 w-full items-center justify-center bg-muted/40 p-4">
              {p.logo ? (
                <img
                  src={p.logo}
                  alt={p.name || "Partner logo"}
                  className="h-full w-auto max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-muted-foreground">No logo</span>
              )}
            </div>
            <CardContent className="space-y-2 p-4">
              <p className="text-sm font-semibold">{p.name || "Untitled partner"}</p>
              <p className="text-xs text-muted-foreground">
                {p.is_published ? "Published" : "Draft"}
                {p.website_url ? ` · ${p.website_url}` : ""}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void togglePublish(p)}>
                  {p.is_published ? "Unpublish" : "Publish"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm("Delete this partner?")) void deleteMut.mutateAsync(p.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && items.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No partners yet. Add a logo to show it on the public homepage.
        </p>
      )}

      <DataPagination
        page={paged.page}
        totalPages={paged.totalPages}
        total={paged.total}
        from={paged.from}
        to={paged.to}
        onPageChange={setPage}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add partner</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Name (admin only)</Label>
              <Input
                className="mt-1.5"
                placeholder="Partner organization"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>Website (optional)</Label>
              <Input
                className="mt-1.5"
                placeholder="https://…"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <MediaImagePicker
              label="Logo"
              aspect="square"
              hint="Square logo works best on the homepage strip."
              value={preview}
              onChange={(url, file) => {
                setPreview(url);
                setImageFile(file);
              }}
              onClear={() => {
                setPreview("");
                setImageFile(undefined);
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="btn-highlight"
              disabled={createMut.isPending || !imageFile || !name.trim()}
              onClick={() => void createMut.mutateAsync()}
            >
              {createMut.isPending ? "Uploading…" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

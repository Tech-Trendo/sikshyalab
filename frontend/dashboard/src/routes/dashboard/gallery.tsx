import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { MediaImagePicker } from "@/components/dashboard/MediaImagePicker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePlus, Images, Loader2, Trash2 } from "lucide-react";
import { paginate } from "@/lib/dashboard-utils";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cmsApi, cmsKeys, type CmsGalleryItem } from "@/lib/cms-api";

export const Route = createFileRoute("/dashboard/gallery")({
  component: GalleryAdminPage,
});

function GalleryAdminPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: cmsKeys.gallery,
    queryFn: () => cmsApi.listGallery(),
  });
  const { data: events = [] } = useQuery({
    queryKey: cmsKeys.events,
    queryFn: () => cmsApi.listEvents(),
  });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [eventId, setEventId] = useState("");
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [preview, setPreview] = useState("");

  const paged = useMemo(() => paginate(items, page, 9), [items, page]);
  const publishedEvents = useMemo(
    () => events.filter((e) => e.is_published !== false),
    [events],
  );
  const eventsById = useMemo(() => {
    const map = new Map<string, (typeof events)[number]>();
    for (const e of events) map.set(String(e.id), e);
    return map;
  }, [events]);

  const resetForm = () => {
    setTitle("");
    setEventId("");
    setImageFile(undefined);
    setPreview("");
  };

  const createMut = useMutation({
    mutationFn: async () => {
      if (!imageFile) throw new Error("Image required");
      if (!eventId) throw new Error("Please select an event");
      const selected = eventsById.get(eventId);
      const form = new FormData();
      form.append("title", title.trim() || "Gallery image");
      form.append("event", eventId);
      form.append("category", selected?.title || "");
      form.append("is_published", "true");
      form.append("image", imageFile);
      const result = await cmsApi.createGalleryItemForm(form);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      toast.success("Gallery item published");
      setOpen(false);
      resetForm();
      void qc.invalidateQueries({ queryKey: cmsKeys.gallery });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not upload");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string | number) => cmsApi.deleteGalleryItem(id),
    onSuccess: () => {
      toast.success("Removed");
      void qc.invalidateQueries({ queryKey: cmsKeys.gallery });
    },
  });

  const togglePublish = async (item: CmsGalleryItem) => {
    const ok = await cmsApi.updateGalleryItem(item.id, {
      is_published: !item.is_published,
    });
    if (ok) {
      toast.success(item.is_published ? "Unpublished" : "Published");
      void qc.invalidateQueries({ queryKey: cmsKeys.gallery });
    } else toast.error("Update failed");
  };

  return (
    <>
      <PageHeader
        title="Gallery"
        subtitle="Images appear on the public /gallery page."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label="Gallery items" value={items.length} icon={Images} tone="primary" />
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          className="btn-highlight"
          onClick={() => {
            setOpen(true);
            resetForm();
          }}
        >
          <ImagePlus className="mr-1 h-4 w-4" /> Add image
        </Button>
      </div>

      {isLoading && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing gallery…
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paged.items.map((g) => (
          <Card key={String(g.id)} className="border-border/60 overflow-hidden">
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
              <img
                src={g.image || ""}
                alt={g.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <CardContent className="space-y-2 p-4">
              <p className="text-sm font-semibold">{g.title}</p>
              <p className="text-xs text-muted-foreground">
                {g.event_title || g.category
                  ? `Event: ${g.event_title || g.category}`
                  : "No event"}{" "}
                · {g.is_published ? "Published" : "Draft"}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void togglePublish(g)}>
                  {g.is_published ? "Unpublish" : "Publish"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm("Delete this image?")) void deleteMut.mutateAsync(g.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add gallery image</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Title</Label>
              <Input className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Event</Label>
              <Select value={eventId || undefined} onValueChange={setEventId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {publishedEvents.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No events available
                    </SelectItem>
                  ) : (
                    publishedEvents.map((e) => (
                      <SelectItem key={String(e.id)} value={String(e.id)}>
                        {e.title}
                        {e.course_title ? ` · ${e.course_title}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <MediaImagePicker
              label="Image"
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
              disabled={createMut.isPending || !imageFile || !eventId}
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

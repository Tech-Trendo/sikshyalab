import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { DateTimePickerField, buildDateTime } from "@/components/dashboard/DateTimePickerField";
import { useDashboardData } from "@/components/dashboard/DashboardDataContext";
import {
  useApproveEventRegistrationMutation,
  useCreateEventMutation,
  useEventRegistrationsQuery,
  useEventsQuery,
  useRejectEventRegistrationMutation,
  useUpdateEventMutation,
} from "@/hooks/useCmsQueries";
import { MediaImagePicker } from "@/components/dashboard/MediaImagePicker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ImagePlus, Loader2, Users } from "lucide-react";
import { paginate } from "@/lib/dashboard-utils";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FormTabNav } from "@/components/dashboard/FormTabNav";
import { SeoFieldsPanel } from "@/components/dashboard/SeoFieldsPanel";
import { useDirtyForm } from "@/hooks/useDirtyForm";

export const Route = createFileRoute("/dashboard/events")({
  component: EventsPage,
});

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "18:00";
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function parseEventDateTime(date: Date | undefined, timeLabel: string): string | null {
  if (!date) return null;
  const built = buildDateTime(date, timeLabel || "00:00");
  if (Number.isNaN(built.getTime())) return null;
  return built.toISOString();
}

const emptyEventForm = {
  title: "",
  date: undefined as Date | undefined,
  time: "18:00",
  location: "Online",
  courseId: "",
  metaTitle: "",
  metaDescription: "",
  ogImage: "",
};

function EventsPage() {
  const { courses } = useDashboardData();
  const { data: apiEvents, isLoading: eventsLoading } = useEventsQuery();
  const { data: registrations = [], isLoading: regsLoading } = useEventRegistrationsQuery();
  const approveReg = useApproveEventRegistrationMutation();
  const rejectReg = useRejectEventRegistrationMutation();
  const createEvent = useCreateEventMutation();
  const updateEventApi = useUpdateEventMutation();

  const events = useMemo(() => {
    if (!apiEvents?.length) return [];
    return apiEvents.map((e) => ({
      title: e.title,
      slug: e.slug,
      date: new Date(e.start_datetime).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }),
      time: formatEventTime(e.start_datetime),
      location: e.location,
      start_datetime: e.start_datetime,
      courseId: e.course ? String(e.course) : "",
      courseTitle: e.course_title || "",
      cover: e.cover_image || "",
      metaTitle: e.meta_title || "",
      metaDescription: e.meta_description || "",
      ogImage: e.og_image || "",
    }));
  }, [apiEvents]);

  const courseOptions = useMemo(
    () =>
      courses
        .filter((c) => c._uuid)
        .map((c) => ({ id: c._uuid!, title: c.title }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [courses],
  );

  const pendingCount = registrations.filter((r) => r.status === "PENDING").length;
  const [eventsPage, setEventsPage] = useState(1);
  const [regsPage, setRegsPage] = useState(1);
  const [editEvent, setEditEvent] = useState<{
    originalSlug: string;
    title: string;
    date?: Date;
    time: string;
    location: string;
    courseId?: string;
    cover?: string;
    slug?: string;
    metaTitle: string;
    metaDescription: string;
    ogImage: string;
  } | null>(null);
  const [editBaseline, setEditBaseline] = useState<typeof editEvent>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | undefined>();
  const [editOgFile, setEditOgFile] = useState<File | undefined>();
  const [editTab, setEditTab] = useState("event");
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [newTab, setNewTab] = useState("event");
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [coverPreview, setCoverPreview] = useState("");
  const [coverFile, setCoverFile] = useState<File | undefined>();
  const [ogFile, setOgFile] = useState<File | undefined>();
  const loading = eventsLoading || regsLoading;
  const editDirty = useDirtyForm(
    { form: editEvent, coverFile: editCoverFile, ogFile: editOgFile },
    editBaseline ? { form: editBaseline, coverFile: undefined, ogFile: undefined } : null,
    Boolean(editEvent),
  );

  const pagedEvents = useMemo(() => paginate(events, eventsPage), [events, eventsPage]);
  const pagedRegs = useMemo(() => paginate(registrations, regsPage), [registrations, regsPage]);

  return (
    <>
      <PageHeader title="Events" subtitle="Manage published events and review registration requests." />
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label="Events" value={events.length} icon={CalendarDays} tone="info" />
        <StatCard label="Pending registrations" value={pendingCount} icon={Users} tone="highlight" />
      </div>

      {loading && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing events…
        </p>
      )}

      <div className="mt-6 space-y-8">
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Published events</h3>
              <Button
                size="sm"
                className="btn-highlight"
                onClick={() => {
                  setCoverPreview("");
                  setCoverFile(undefined);
                  setOgFile(undefined);
                  setNewTab("event");
                  setEventForm(emptyEventForm);
                  setNewEventOpen(true);
                }}
              >
                <ImagePlus className="mr-1 h-4 w-4" /> New event
              </Button>
            </div>
            {pagedEvents.items.map((e) => (
              <Card key={e.slug || e.title} className="border-border/60">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    {e.cover ? (
                      <div className="relative aspect-[16/9] w-28 shrink-0 overflow-hidden rounded-md bg-muted">
                        <img src={e.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      </div>
                    ) : null}
                    <div>
                      <p className="text-sm font-semibold">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.date} • {e.time} • {e.location}
                        {e.courseTitle ? ` • ${e.courseTitle}` : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditCoverFile(undefined);
                      setEditOgFile(undefined);
                      setEditTab("event");
                      const next = {
                        originalSlug: e.slug || e.title,
                        title: e.title,
                        date: new Date(e.start_datetime),
                        time: formatEventTime(e.start_datetime),
                        location: e.location,
                        courseId: e.courseId,
                        cover: e.cover,
                        slug: e.slug,
                        metaTitle: e.metaTitle,
                        metaDescription: e.metaDescription,
                        ogImage: e.ogImage,
                      };
                      setEditEvent(next);
                      setEditBaseline(next);
                    }}
                  >
                    Edit
                  </Button>
                </CardContent>
              </Card>
            ))}
          {!events.length && !loading && (
            <p className="text-sm text-muted-foreground">No events from the API yet.</p>
          )}
          <DataPagination
            page={pagedEvents.page}
            totalPages={pagedEvents.totalPages}
            total={pagedEvents.total}
            from={pagedEvents.from}
            to={pagedEvents.to}
            onPageChange={setEventsPage}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Event registrations</h3>
          {pagedRegs.items.map((r) => (
            <Card key={String(r.id)} className="border-border/60">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.email}
                      {r.phone ? ` · ${r.phone}` : ""}
                    </p>
                    <p className="mt-1 text-xs font-medium text-foreground/80">Event: {r.event_title}</p>
                    {r.message ? <p className="mt-2 text-xs text-muted-foreground">{r.message}</p> : null}
                  </div>
                  <Badge
                    variant={
                      r.status === "APPROVED" ? "default" : r.status === "REJECTED" ? "destructive" : "secondary"
                    }
                  >
                    {r.status}
                  </Badge>
                </div>
                {r.status === "PENDING" && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={approveReg.isPending}
                      onClick={() =>
                        void approveReg.mutateAsync(r.id).then((res) => {
                          if (res) toast.success("Approved — details emailed");
                          else toast.error("Could not approve");
                        })
                      }
                    >
                      Approve & email details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={rejectReg.isPending}
                      onClick={() =>
                        void rejectReg.mutateAsync(r.id).then((res) => {
                          if (res) toast.success("Registration rejected");
                          else toast.error("Could not reject");
                        })
                      }
                    >
                      Reject
                    </Button>
                  </div>
                )}
                {r.status === "APPROVED" && r.details_emailed_at ? (
                  <p className="text-xs text-muted-foreground">
                    Details emailed {new Date(r.details_emailed_at).toLocaleString()}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
          {!registrations.length && !loading && (
            <p className="text-sm text-muted-foreground">
              No registrations yet. They appear here when visitors submit Register now.
            </p>
          )}
          <DataPagination
            page={pagedRegs.page}
            totalPages={pagedRegs.totalPages}
            total={pagedRegs.total}
            from={pagedRegs.from}
            to={pagedRegs.to}
            onPageChange={setRegsPage}
          />
        </section>
      </div>

      <Dialog open={!!editEvent} onOpenChange={(o) => !o && setEditEvent(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit event</DialogTitle></DialogHeader>
          {editEvent && (
            <div className="grid gap-3">
              <FormTabNav
                value={editTab}
                onChange={setEditTab}
                tabs={[
                  { id: "event", label: "Event", error: !editEvent.title.trim() },
                  { id: "seo", label: "SEO" },
                ]}
              />
              {editTab === "event" ? (
                <>
              <div><Label>Title</Label><Input className="mt-1.5" value={editEvent.title} onChange={(e) => setEditEvent({ ...editEvent, title: e.target.value })} /></div>
              <DateTimePickerField
                date={editEvent.date}
                time={editEvent.time}
                onDateChange={(date) => setEditEvent({ ...editEvent, date })}
                onTimeChange={(time) => setEditEvent({ ...editEvent, time })}
              />
              <div>
                <Label>Location</Label>
                <Input className="mt-1.5" value={editEvent.location} onChange={(e) => setEditEvent({ ...editEvent, location: e.target.value })} />
              </div>
              <div>
                <Label>Associated course</Label>
                <Select
                  value={editEvent.courseId || "__none__"}
                  onValueChange={(v) => setEditEvent({ ...editEvent, courseId: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {courseOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <MediaImagePicker
                label="Cover image (16:9)"
                value={editEvent.cover}
                onChange={(url, file) => {
                  setEditEvent({ ...editEvent, cover: url });
                  setEditCoverFile(file);
                }}
                onClear={() => setEditCoverFile(undefined)}
              />
                </>
              ) : (
                <SeoFieldsPanel
                  value={{
                    metaTitle: editEvent.metaTitle,
                    metaDescription: editEvent.metaDescription,
                    ogImage: editEvent.ogImage,
                  }}
                  titleFallback={editEvent.title}
                  onOgFile={setEditOgFile}
                  onChange={(seo) =>
                    setEditEvent({
                      ...editEvent,
                      metaTitle: seo.metaTitle,
                      metaDescription: seo.metaDescription,
                      ogImage: seo.ogImage || "",
                    })
                  }
                />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEvent(null)}>Cancel</Button>
            <Button
              disabled={updateEventApi.isPending || !editDirty}
              onClick={() => {
                if (!editEvent) return;
                void (async () => {
                  const start = parseEventDateTime(editEvent.date, editEvent.time);
                  const res = await updateEventApi.mutateAsync({
                    slug: editEvent.originalSlug,
                    patch: {
                      title: editEvent.title,
                      location: editEvent.location,
                      course: editEvent.courseId || null,
                      ...(start ? { start_datetime: start } : {}),
                      is_published: true,
                      ...(editEvent.metaTitle.trim() ? { meta_title: editEvent.metaTitle.trim() } : {}),
                      ...(editEvent.metaDescription.trim()
                        ? { meta_description: editEvent.metaDescription.trim() }
                        : {}),
                    },
                    coverFile: editCoverFile,
                    ogFile: editOgFile,
                  });
                  if (res) {
                    toast.success("Event updated");
                    setEditEvent(null);
                  } else toast.error("Could not update event");
                })();
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newEventOpen} onOpenChange={setNewEventOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New event</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <FormTabNav
              value={newTab}
              onChange={setNewTab}
              tabs={[
                { id: "event", label: "Event", error: !eventForm.title.trim() || !eventForm.date },
                { id: "seo", label: "SEO" },
              ]}
            />
            {newTab === "event" ? (
              <>
            <div><Label>Title</Label><Input className="mt-1.5" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} /></div>
            <DateTimePickerField
              date={eventForm.date}
              time={eventForm.time}
              onDateChange={(date) => setEventForm({ ...eventForm, date })}
              onTimeChange={(time) => setEventForm({ ...eventForm, time })}
            />
            <div><Label>Location</Label><Input className="mt-1.5" value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} /></div>
            <div>
              <Label>Associated course</Label>
              <Select
                value={eventForm.courseId || "__none__"}
                onValueChange={(v) => setEventForm({ ...eventForm, courseId: v === "__none__" ? "" : v })}
              >
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {courseOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <MediaImagePicker
              label="Cover image (16:9)"
              value={coverPreview}
              onChange={(url, file) => {
                setCoverPreview(url);
                setCoverFile(file);
              }}
              onClear={() => {
                setCoverPreview("");
                setCoverFile(undefined);
              }}
            />
              </>
            ) : (
              <SeoFieldsPanel
                value={{
                  metaTitle: eventForm.metaTitle,
                  metaDescription: eventForm.metaDescription,
                  ogImage: eventForm.ogImage,
                }}
                titleFallback={eventForm.title}
                onOgFile={setOgFile}
                onChange={(seo) =>
                  setEventForm({
                    ...eventForm,
                    metaTitle: seo.metaTitle,
                    metaDescription: seo.metaDescription,
                    ogImage: seo.ogImage || "",
                  })
                }
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewEventOpen(false)}>Cancel</Button>
            <Button
              disabled={createEvent.isPending}
              onClick={() => {
                if (!eventForm.title.trim() || !eventForm.date) {
                  setNewTab("event");
                  toast.error("Title and date are required");
                  return;
                }
                const start = parseEventDateTime(eventForm.date, eventForm.time);
                if (!start) {
                  toast.error("Invalid date or time");
                  return;
                }
                void (async () => {
                  const res = await createEvent.mutateAsync({
                    payload: {
                      title: eventForm.title,
                      location: eventForm.location,
                      start_datetime: start,
                      course: eventForm.courseId || null,
                      is_published: true,
                      ...(eventForm.metaTitle.trim() ? { meta_title: eventForm.metaTitle.trim() } : {}),
                      ...(eventForm.metaDescription.trim()
                        ? { meta_description: eventForm.metaDescription.trim() }
                        : {}),
                    },
                    coverFile,
                    ogFile,
                  });
                  if (res) {
                    toast.success("Event created");
                    setNewEventOpen(false);
                    setEventForm(emptyEventForm);
                    setCoverPreview("");
                    setCoverFile(undefined);
                    setOgFile(undefined);
                  } else toast.error("Could not create event");
                })();
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

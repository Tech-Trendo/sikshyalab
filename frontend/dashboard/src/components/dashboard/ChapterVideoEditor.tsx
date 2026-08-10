import React, { useMemo, useState, useRef } from "react";
import PartedVideoPlayer from "./PartedVideoPlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDashboardData } from "@/components/dashboard/DashboardDataContext";
import { toast } from "sonner";

type Part = { id?: string | number; title: string; start_time: number; end_time: number; order?: number };

export default function ChapterVideoEditor({ courseSlug, chapterIdx, chapter }: {
  courseSlug: string;
  chapterIdx: number;
  chapter: any;
}) {
  const { updateCourse, courses } = useDashboardData() as any;
  const existingVideo = chapter?.video || null;
  const [videoUrl, setVideoUrl] = useState(existingVideo?.url || "");
  const [parts, setParts] = useState<Part[]>(existingVideo?.parts?.slice() || []);
  const [selectedPartId, setSelectedPartId] = useState<string | number | null>(parts[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const playerRef = useRef<any>(null);

  const addPart = () => {
    setParts((prev) => [...prev, { id: Date.now(), title: `Part ${prev.length + 1}`, start_time: 0, end_time: 10, order: prev.length + 1 }]);
  };

  const setStartToCurrent = (id: string | number) => {
    const t = playerRef.current?.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
    setParts((prev) => prev.map((p) => (String(p.id) === String(id) ? { ...p, start_time: Math.floor(t) } : p)));
  };

  const setEndToCurrent = (id: string | number) => {
    const t = playerRef.current?.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
    setParts((prev) => prev.map((p) => (String(p.id) === String(id) ? { ...p, end_time: Math.ceil(Math.max(p.start_time + 1, t)) } : p)));
  };

  const save = async () => {
    if (!videoUrl.trim()) {
      toast.error("Video URL is required");
      return;
    }
    // Basic validation
    for (const p of parts) {
      if (!p.title.trim()) return toast.error("Part title required");
      if (p.start_time < 0 || p.end_time <= p.start_time) return toast.error("Invalid part timestamps");
    }
    setBusy(true);
    try {
      // Update local course chapters state; backend persistence requires new endpoints
      const course = courses.find((c: any) => c.slug === courseSlug);
      if (!course) throw new Error("Course not found");
      const nextChapters = course.chapters.map((ch: any, i: number) =>
        i === chapterIdx ? { ...ch, video: { url: videoUrl.trim(), parts } } : ch,
      );
      updateCourse(courseSlug, { chapters: nextChapters });
      toast.success("Chapter video updated locally — backend persistence requires API support.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      <div>
        <Label>Video URL</Label>
        <Input className="mt-1.5" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="/media/videos/… or https://…" />
      </div>
      {videoUrl ? (
        <div>
          <PartedVideoPlayer ref={playerRef} src={videoUrl} accessToken={null} parts={parts} selectedPartId={selectedPartId} />
          <div className="mt-3 space-y-2">
            {parts.map((p) => (
              <div key={String(p.id)} className="rounded-md border border-border/60 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <Input value={p.title} onChange={(e) => setParts((prev) => prev.map((x) => (x.id === p.id ? { ...x, title: e.target.value } : x)))} />
                    <div className="text-xs text-muted-foreground mt-1">{new Date(p.start_time * 1000).toISOString().slice(11, 19)} - {new Date(p.end_time * 1000).toISOString().slice(11, 19)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => setStartToCurrent(p.id)}>Set start</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEndToCurrent(p.id)}>Set end</Button>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" onClick={addPart}>+ Add part</Button>
              <Button className="btn-highlight" disabled={busy} onClick={save}>Save chapter video (local)</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import PartedVideoPlayer, { type VideoSection } from "./PartedVideoPlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDashboardData } from "@/components/dashboard/DashboardDataContext";
import { contentApi } from "@/lib/content-api";
import { getAccessToken } from "@/lib/api";
import { toast } from "sonner";

type Part = VideoSection;

function normalizeParts(raw: any[] | undefined): Part[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p, i) => ({
    id: p.id ?? `local-${i}`,
    title: p.title || `Section ${i + 1}`,
    start_time: Number(p.start_time ?? p.startTime ?? 0),
    end_time: Number(p.end_time ?? p.endTime ?? 0),
    order: Number(p.order ?? i + 1),
  }));
}

export default function ChapterVideoEditor({
  courseSlug,
  chapterIdx,
  chapter,
}: {
  courseSlug: string;
  chapterIdx: number;
  chapter: any;
}) {
  const { updateCourseLocal, courses } = useDashboardData() as any;
  const existingVideo = chapter?.video || null;
  const [videoUrl, setVideoUrl] = useState(existingVideo?.url || "");
  const [parts, setParts] = useState<Part[]>(normalizeParts(existingVideo?.parts));
  const [selectedPartId, setSelectedPartId] = useState<string | number | null>(
    normalizeParts(existingVideo?.parts)[0]?.id ?? null,
  );
  const [busy, setBusy] = useState(false);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    setVideoUrl(existingVideo?.url || "");
    const next = normalizeParts(existingVideo?.parts);
    setParts(next);
    setSelectedPartId(next[0]?.id ?? null);
  }, [chapter?.id, existingVideo?.url, existingVideo?.parts]);

  const addPart = () => {
    const lastEnd = parts.length ? Math.max(...parts.map((p) => p.end_time)) : 0;
    const next: Part = {
      id: `new-${Date.now()}`,
      title: `Section ${parts.length + 1}`,
      start_time: lastEnd,
      end_time: lastEnd + 30,
      order: parts.length + 1,
    };
    setParts((prev) => [...prev, next]);
    setSelectedPartId(next.id ?? null);
  };

  const setStartToCurrent = (id: string | number) => {
    const t = playerRef.current?.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
    setParts((prev) =>
      prev.map((p) => (String(p.id) === String(id) ? { ...p, start_time: Math.floor(t) } : p)),
    );
  };

  const setEndToCurrent = (id: string | number) => {
    const t = playerRef.current?.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
    setParts((prev) =>
      prev.map((p) =>
        String(p.id) === String(id)
          ? { ...p, end_time: Math.ceil(Math.max(p.start_time + 1, t)) }
          : p,
      ),
    );
  };

  const save = async () => {
    if (!videoUrl.trim()) {
      toast.error("Video URL is required");
      return;
    }
    if (!chapter?.id) {
      toast.error("Chapter is missing a backend id — refresh and try again");
      return;
    }
    for (const p of parts) {
      if (!p.title.trim()) return toast.error("Section title required");
      if (p.start_time < 0 || p.end_time <= p.start_time) {
        return toast.error("Invalid section timestamps");
      }
    }
    const ordered = parts
      .slice()
      .sort((a, b) => a.start_time - b.start_time)
      .map((p, i) => ({
        title: p.title.trim(),
        start_time: p.start_time,
        end_time: p.end_time,
        order: i + 1,
      }));
    const duration = ordered.length
      ? Math.max(...ordered.map((p) => p.end_time))
      : Math.floor(playerRef.current?.getDuration?.() || 0);

    setBusy(true);
    try {
      const res = await contentApi.updateChapter(String(chapter.id), {
        video: {
          title: `${chapter.title} Full Video`,
          video_url: videoUrl.trim(),
          duration,
          parts: ordered,
        },
      });
      if (!res.ok || !res.data) {
        toast.error(res.detail || "Could not save chapter video");
        return;
      }
      const saved = res.data.video;
      const course = courses.find((c: any) => c.slug === courseSlug);
      if (course) {
        const nextChapters = course.chapters.map((ch: any, i: number) =>
          i === chapterIdx
            ? {
                ...ch,
                video: saved
                  ? {
                      id: saved.id,
                      title: saved.title,
                      url: saved.url || videoUrl.trim(),
                      duration: saved.duration,
                      parts: normalizeParts(saved.parts),
                    }
                  : {
                      url: videoUrl.trim(),
                      duration,
                      parts: ordered,
                    },
              }
            : ch,
        );
        updateCourseLocal(courseSlug, { chapters: nextChapters });
      }
      toast.success("Chapter video saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      <div>
        <Label htmlFor="chapter-video-url">Continuous chapter video URL</Label>
        <Input
          id="chapter-video-url"
          name="video_url"
          className="mt-1.5"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="/media/… or https://…"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          One video for the whole chapter. Add section markers (title, start, end) so students can
          jump on the timeline without switching players.
        </p>
      </div>
      {videoUrl ? (
        <div>
          <PartedVideoPlayer
            ref={playerRef}
            src={videoUrl}
            accessToken={getAccessToken()}
            parts={parts}
            selectedPartId={selectedPartId}
            pauseAtPartEnd={false}
          />
          <div className="mt-3 space-y-2">
            {parts.map((p) => (
              <div key={String(p.id)} className="rounded-md border border-border/60 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <Input
                      id={`chapter-part-title-${p.id}`}
                      name={`part_title_${p.id}`}
                      value={p.title}
                      onChange={(e) =>
                        setParts((prev) =>
                          prev.map((x) => (x.id === p.id ? { ...x, title: e.target.value } : x)),
                        )
                      }
                      onFocus={() => setSelectedPartId(p.id ?? null)}
                    />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(p.start_time * 1000).toISOString().slice(11, 19)} –{" "}
                      {new Date(p.end_time * 1000).toISOString().slice(11, 19)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => setStartToCurrent(p.id!)}>
                      Set start
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEndToCurrent(p.id!)}>
                      Set end
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" onClick={addPart}>
                + Add section
              </Button>
              <Button className="btn-highlight" disabled={busy} onClick={() => void save()}>
                Save chapter video
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
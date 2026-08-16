import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProtectedVideo, type ProtectedVideoHandle } from "@/components/dashboard/ContentProtection";
import { useAuth } from "@/components/dashboard/AuthContext";
import { contentApi } from "@/lib/content-api";
import { cn } from "@/lib/utils";
import {
  activeTimestampIndex,
  formatTimestampClock,
  normalizeVideoTimestampList,
  type VideoTimestamp,
} from "@/lib/video-timestamps";
import { toast } from "sonner";

type ResourceVideoPlayerProps = {
  resourceId: string;
  /** Short-lived signed (or fallback) playback URL owned by the parent. */
  src: string;
  title?: string;
  nestedTimestamps?: unknown;
  canEdit?: boolean;
  className?: string;
  refreshing?: boolean;
  onMediaError?: () => void;
};

/**
 * Video playback + YouTube-style timestamps.
 * `src` should be the backend stream URL (same-origin), not a storage/signed URL.
 */
export function ResourceVideoPlayer({
  resourceId,
  src,
  title,
  nestedTimestamps,
  canEdit,
  className,
  refreshing = false,
  onMediaError,
}: ResourceVideoPlayerProps) {
  const { isTeacher, isAdmin } = useAuth();
  const editable = canEdit ?? (isTeacher || isAdmin);
  const videoRef = useRef<ProtectedVideoHandle>(null);
  const resumeAtRef = useRef(0);
  const prevSrcRef = useRef(src);

  const [timestamps, setTimestamps] = useState<VideoTimestamp[]>(() =>
    normalizeVideoTimestampList(nestedTimestamps),
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prevSrcRef.current !== src) {
      resumeAtRef.current = currentTime;
      prevSrcRef.current = src;
    }
  }, [src, currentTime]);

  useEffect(() => {
    let cancelled = false;
    void contentApi.listResourceTimestamps(resourceId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setTimestamps(result.data);
        return;
      }
      const nested = normalizeVideoTimestampList(nestedTimestamps);
      if (nested.length) setTimestamps(nested);
    });
    return () => {
      cancelled = true;
    };
  }, [resourceId, nestedTimestamps]);

  const handleLoadedData = useCallback((video: HTMLVideoElement) => {
    const resumeAt = resumeAtRef.current;
    if (resumeAt > 0.25) {
      video.currentTime = resumeAt;
      resumeAtRef.current = 0;
      void video.play().catch(() => {
        /* autoplay may be blocked */
      });
    }
  }, []);

  const activeIdx = activeTimestampIndex(timestamps, currentTime);

  const seekTo = (seconds: number) => {
    videoRef.current?.seekTo(seconds, true);
  };

  const addCurrent = async () => {
    const text = label.trim();
    if (!text) {
      toast.error("Enter a timestamp label");
      return;
    }
    const time_seconds = Math.max(0, Math.floor(videoRef.current?.getCurrentTime() ?? 0));
    setSaving(true);
    try {
      const result = await contentApi.createResourceTimestamp(resourceId, {
        time_seconds,
        label: text,
      });
      if (!result.ok) {
        toast.error("Could not add timestamp", { description: result.detail });
        return;
      }
      const created = result.data ?? { time_seconds, label: text };
      setTimestamps((prev) =>
        [...prev, created].sort((a, b) => a.time_seconds - b.time_seconds),
      );
      setLabel("");
      toast.success(`Added ${formatTimestampClock(time_seconds)}`);
    } finally {
      setSaving(false);
    }
  };

  const removeTimestamp = async (ts: VideoTimestamp) => {
    if (!ts.id) {
      setTimestamps((prev) => prev.filter((row) => row !== ts));
      return;
    }
    const result = await contentApi.deleteResourceTimestamp(resourceId, ts.id);
    if (!result.ok) {
      toast.error("Could not remove timestamp", { description: result.detail });
      return;
    }
    setTimestamps((prev) => prev.filter((row) => row.id !== ts.id));
  };

  const showPanel = timestamps.length > 0 || editable;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <ProtectedVideo
          ref={videoRef}
          src={src}
          title={title}
          signedSrc
          onTimeUpdate={setCurrentTime}
          onMediaError={onMediaError}
          onLoadedData={handleLoadedData}
        />
        {refreshing ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-10 z-10 flex justify-center px-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-black/75 px-3 py-1.5 text-xs text-white shadow">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Refreshing video…
            </span>
          </div>
        ) : null}
      </div>

      {showPanel ? (
        <div className="rounded-md border border-border/60 bg-background/80 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Timestamps
          </div>

          {timestamps.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No timestamps yet. Play the video, then add a marker at the current time.
            </p>
          ) : (
            <ul className="max-h-52 space-y-0.5 overflow-y-auto">
              {timestamps.map((ts, idx) => {
                const active = idx === activeIdx;
                return (
                  <li key={ts.id ?? `${ts.time_seconds}-${ts.label}-${idx}`}>
                    <div className="flex items-stretch gap-1">
                      <button
                        type="button"
                        onClick={() => seekTo(ts.time_seconds)}
                        className={cn(
                          "flex min-w-0 flex-1 items-baseline gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          active
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground hover:bg-muted",
                        )}
                      >
                        <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-primary">
                          {formatTimestampClock(ts.time_seconds)}
                        </span>
                        <span className="min-w-0 truncate">{ts.label}</span>
                      </button>
                      {editable ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => void removeTimestamp(ts)}
                          aria-label={`Remove ${ts.label}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {editable ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                name="timestamp_label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (e.g. Intro, Exercise 1)"
                className="sm:flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addCurrent();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={saving}
                onClick={() => void addCurrent()}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add current timestamp
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

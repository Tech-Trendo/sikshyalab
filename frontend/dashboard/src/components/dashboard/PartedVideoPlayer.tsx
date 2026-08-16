import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { withMediaAccessToken } from "./ContentProtection";
import { cn } from "@/lib/utils";

export type VideoSection = {
  id?: string | number;
  title: string;
  start_time: number;
  end_time: number;
  order?: number;
};

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export type PartedVideoPlayerHandle = {
  getCurrentTime: () => number;
  getDuration: () => number;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
};

type Props = {
  src: string;
  accessToken?: string | null;
  parts?: VideoSection[];
  /** Seek to this section when it changes (optional). Continuous play by default. */
  selectedPartId?: string | number | null;
  onPartChange?: (part: VideoSection | null) => void;
  onTimeUpdate?: (t: number) => void;
  /** When true, pause once the selected section ends (editor preview). Default: continuous. */
  pauseAtPartEnd?: boolean;
  className?: string;
};

const PartedVideoPlayer = forwardRef<PartedVideoPlayerHandle, Props>(function PartedVideoPlayer(
  {
    src,
    accessToken,
    parts = [],
    selectedPartId,
    onPartChange,
    onTimeUpdate,
    pauseAtPartEnd = false,
    className,
  },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activePartId, setActivePartId] = useState<string | number | null>(
    selectedPartId ?? parts[0]?.id ?? null,
  );

  const sortedParts = [...parts].sort(
    (a, b) => (a.order ?? a.start_time) - (b.order ?? b.start_time),
  );

  const findPartAt = useCallback(
    (t: number) =>
      sortedParts.find((p) => t >= p.start_time && t < p.end_time) ||
      sortedParts.find((p) => t >= p.start_time && t <= p.end_time) ||
      null,
    [sortedParts],
  );

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    getDuration: () => videoRef.current?.duration || duration || 0,
    play: () => {
      void videoRef.current?.play();
    },
    pause: () => videoRef.current?.pause(),
    seekTo: (seconds: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, seconds);
      }
    },
  }));

  const seekToPart = useCallback((part: VideoSection) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, part.start_time);
    setActivePartId(part.id ?? null);
    onPartChange?.(part);
    void video.play();
  }, [onPartChange]);

  useEffect(() => {
    if (selectedPartId == null) return;
    const sp = sortedParts.find((p) => String(p.id) === String(selectedPartId));
    if (sp) seekToPart(sp);
    // Only react to external selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => setDuration(video.duration || 0);
    const onTime = () => {
      const t = video.currentTime;
      setCurrentTime(t);
      onTimeUpdate?.(t);

      const current = findPartAt(t);
      const nextId = current?.id ?? null;
      setActivePartId((prev) => {
        if (String(prev) !== String(nextId)) {
          onPartChange?.(current);
        }
        return nextId;
      });

      if (pauseAtPartEnd && selectedPartId != null) {
        const sp = sortedParts.find((p) => String(p.id) === String(selectedPartId));
        if (sp && t >= sp.end_time) {
          video.pause();
        }
      }
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("durationchange", onLoaded);
    video.addEventListener("timeupdate", onTime);
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("durationchange", onLoaded);
      video.removeEventListener("timeupdate", onTime);
    };
  }, [
    findPartAt,
    onPartChange,
    onTimeUpdate,
    pauseAtPartEnd,
    selectedPartId,
    sortedParts,
  ]);

  const secureSrc = withMediaAccessToken(src, accessToken);
  const total = duration > 0 ? duration : Math.max(...sortedParts.map((p) => p.end_time), 1);
  const progressPct = Math.min(100, (currentTime / total) * 100);
  const activePart = sortedParts.find((p) => String(p.id) === String(activePartId)) || findPartAt(currentTime);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative aspect-video overflow-hidden rounded-md bg-black">
        <video
          ref={videoRef}
          src={secureSrc}
          crossOrigin="use-credentials"
          controls
          controlsList="nodownload noplaybackrate noremoteplayback"
          disablePictureInPicture
          playsInline
          className="h-full w-full"
          title="Chapter video"
        />
      </div>

      {/* Continuous timeline with section markers (YouTube-style chapters) */}
      {sortedParts.length > 0 ? (
        <div className="space-y-2">
          <button
            type="button"
            className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
            aria-label="Video timeline"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              const t = ratio * total;
              if (videoRef.current) {
                videoRef.current.currentTime = t;
                void videoRef.current.play();
              }
            }}
          >
            <div
              className="absolute inset-y-0 left-0 bg-primary/70"
              style={{ width: `${progressPct}%` }}
            />
            {sortedParts.map((p) => {
              const left = Math.min(100, (p.start_time / total) * 100);
              const isActive = String(p.id) === String(activePart?.id);
              return (
                <span
                  key={String(p.id ?? `${p.start_time}-${p.title}`)}
                  title={`${p.title} (${formatClock(p.start_time)})`}
                  className={cn(
                    "absolute top-1/2 z-10 h-3 w-1 -translate-y-1/2 rounded-sm",
                    isActive ? "bg-primary" : "bg-foreground/70",
                  )}
                  style={{ left: `${left}%` }}
                />
              );
            })}
          </button>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatClock(currentTime)} / {formatClock(total)}
              {activePart ? ` · ${activePart.title}` : ""}
            </span>
            <span>{sortedParts.length} sections</span>
          </div>

          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2">
            {sortedParts.map((p, idx) => {
              const isActive = String(p.id) === String(activePart?.id);
              return (
                <li key={String(p.id ?? idx)}>
                  <button
                    type="button"
                    onClick={() => seekToPart(p)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-foreground",
                    )}
                  >
                    <span className="min-w-0 truncate">
                      {idx + 1}. {p.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatClock(p.start_time)}–{formatClock(p.end_time)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
});

export default PartedVideoPlayer;
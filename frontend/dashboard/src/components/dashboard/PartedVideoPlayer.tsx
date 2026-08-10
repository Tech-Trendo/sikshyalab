import React, { useEffect, useRef, useState, useCallback, useImperativeHandle } from "react";
import { ProtectedVideo, withMediaAccessToken } from "./ContentProtection";

type Part = { id?: string | number; title: string; start_time: number; end_time: number; order?: number };

export default React.forwardRef(function PartedVideoPlayer({
  src,
  accessToken,
  parts = [],
  selectedPartId,
  onPartEnd,
  onTimeUpdate,
  editable = false,
}: {
  src: string;
  accessToken?: string | null;
  parts?: Part[];
  selectedPartId?: string | number | null;
  onPartEnd?: (part?: Part) => void;
  onTimeUpdate?: (t: number) => void;
  editable?: boolean;
}, ref: any) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
      const sp = parts.find((p) => String(p.id) === String(selectedPartId));
      if (sp && video.currentTime >= sp.end_time) {
        video.pause();
        onPartEnd?.(sp);
      }
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [parts, selectedPartId, onPartEnd, onTimeUpdate]);

  useEffect(() => {
    // If a new part was selected, seek to its start
    const sp = parts.find((p) => String(p.id) === String(selectedPartId));
    const video = videoRef.current;
    if (sp && video) {
      try {
        video.currentTime = Math.max(0, sp.start_time);
        void video.play();
      } catch {
        // ignore
      }
    }
  }, [selectedPartId, parts]);

  // Expose helpers for editors to read current time
  const getCurrentTime = useCallback(() => videoRef.current?.currentTime ?? 0, []);

  const secureSrc = withMediaAccessToken(src, accessToken);

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-md bg-black">
        <video
          ref={videoRef}
          src={secureSrc}
          controls
          controlsList="nodownload noplaybackrate noremoteplayback"
          disablePictureInPicture
          playsInline
          className="h-full w-full"
          title="Chapter video"
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <div>Current time: {new Date((getCurrentTime() || 0) * 1000).toISOString().slice(11, 19)}</div>
        {editable ? (
          <div className="text-right text-xs">
            <span className="mr-2">Use controls below to set timestamps.</span>
          </div>
        ) : null}
      </div>
    </div>
    );
  });

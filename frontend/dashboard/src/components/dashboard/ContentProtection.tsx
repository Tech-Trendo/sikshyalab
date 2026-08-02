"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type ContentProtectionProps = {
  children: ReactNode;
  className?: string;
  /** Soft blank overlay when tab is hidden / window blurred (screen-share deterrent). */
  blankOnHide?: boolean;
};

/**
 * Soft content-protection layer for authenticated learning surfaces.
 * Blocks right-click / common save shortcuts and blanks media when the tab is hidden.
 * Note: this is a deterrent, not DRM — dedicated screen recorders can still capture.
 */
export function ContentProtection({
  children,
  className,
  blankOnHide = true,
}: ContentProtectionProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const block =
        key === "printscreen" ||
        (e.ctrlKey && ["s", "p", "u"].includes(key)) ||
        (e.metaKey && ["s", "p", "u"].includes(key)) ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(key)) ||
        (e.metaKey && e.altKey && key === "i");
      if (block) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onVisibility = () => {
      if (!blankOnHide) return;
      setHidden(document.hidden);
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [blankOnHide]);

  return (
    <div
      className={cn(
        "relative select-none",
        className,
      )}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
      {hidden ? (
        <div
          className="fixed inset-0 z-[200] grid place-items-center bg-background/95 px-6 text-center"
          role="presentation"
        >
          <div>
            <p className="text-lg font-semibold text-foreground">Content paused</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Learning media is hidden while this window is inactive to reduce casual screen
              capture. Return focus to continue.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Append JWT for private /media URLs so &lt;video&gt; / &lt;img&gt; can load authenticated files. */
export function withMediaAccessToken(url: string, token?: string | null): string {
  if (!url || !token) return url;
  try {
    const isRelative = url.startsWith("/");
    const parsed = isRelative
      ? new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost")
      : new URL(url);
    const path = parsed.pathname;
    if (!path.includes("/media/")) return url;
    // Only private lesson paths need a token
    if (
      !path.includes("/media/content/") &&
      !path.includes("/media/assignments/") &&
      !path.includes("/media/enrollments/")
    ) {
      return url;
    }
    parsed.searchParams.set("access_token", token);
    return isRelative ? `${parsed.pathname}${parsed.search}` : parsed.toString();
  } catch {
    return url;
  }
}

export function ProtectedVideo({
  src,
  title,
  className,
  accessToken,
}: {
  src: string;
  title?: string;
  className?: string;
  accessToken?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pausedOverlay, setPausedOverlay] = useState(false);

  const secureSrc = withMediaAccessToken(src, accessToken);

  const onVisibility = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.hidden) {
      video.pause();
      setPausedOverlay(true);
    } else {
      setPausedOverlay(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [onVisibility]);

  return (
    <div
      className={cn("relative aspect-video overflow-hidden rounded-md bg-black", className)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={videoRef}
        src={secureSrc}
        controls
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        playsInline
        className="h-full w-full"
        title={title}
        onContextMenu={(e) => e.preventDefault()}
      />
      {pausedOverlay ? (
        <div className="absolute inset-0 grid place-items-center bg-black/80 text-sm text-white">
          Video paused — return to this tab to continue.
        </div>
      ) : null}
    </div>
  );
}

export function ProtectedIframe({
  src,
  title,
  className,
}: {
  src: string;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("relative aspect-video overflow-hidden rounded-md bg-black", className)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <iframe
        title={title || "Lesson video"}
        src={src}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

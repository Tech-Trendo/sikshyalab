"use client";

import { useState } from "react";
import Image from "next/image";
import { shouldUnoptimizeImageSrc } from "@/lib/env";
import { cn } from "@/lib/utils";

export function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

type PersonAvatarProps = {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  fallbackClassName?: string;
};

/** Photo when present; otherwise name initials. Switches back to initials if the image fails. */
export function PersonAvatar({
  src,
  name,
  size = 48,
  className,
  fallbackClassName,
}: PersonAvatarProps) {
  const [failed, setFailed] = useState(false);
  const url = typeof src === "string" ? src.trim() : "";
  const showImage = Boolean(url) && !failed;

  if (showImage) {
    return (
      <Image
        src={url}
        alt={name}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", className)}
        unoptimized={shouldUnoptimizeImageSrc(url)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-brand-navy font-bold text-white",
        className,
        fallbackClassName,
      )}
      style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.32)) }}
      aria-label={name}
    >
      {initialsFromName(name)}
    </span>
  );
}

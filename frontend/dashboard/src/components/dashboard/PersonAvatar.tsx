import { useState } from "react";
import { cn } from "@/lib/utils";

export function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

/** Profile photo when set; otherwise initials. Falls back to initials if the image fails. */
export function PersonAvatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = typeof src === "string" ? src.trim() : "";
  const showImage = Boolean(url) && !failed;

  if (showImage) {
    return (
      <img
        src={url}
        alt={name}
        className={cn("rounded-full object-cover", className)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        "grid place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground",
        className,
      )}
      aria-label={name}
    >
      {initialsFromName(name)}
    </div>
  );
}

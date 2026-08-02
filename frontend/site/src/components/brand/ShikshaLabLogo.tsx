import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  imageClassName?: string;
  wordmarkClassName?: string;
  /** English wordmark beside the emblem (off by default — brand mark already includes type). */
  showWordmark?: boolean;
  src?: string | null;
  /** Circular crop for icon-only use (e.g. avatars). */
  rounded?: boolean;
  /** Invert for dark surfaces when the asset isn’t already light-safe */
  variant?: "default" | "onDark";
};

/** Clear brand emblem (native-resolution asset — do not upscale source) */
const LOGO_MARK = "/shikshalab-brand.png";

export function ShikshaLabLogo({
  className,
  imageClassName,
  wordmarkClassName,
  showWordmark = false,
  src,
  rounded = false,
  variant = "default",
}: Props) {
  const markSrc = src?.trim() || LOGO_MARK;

  if (rounded) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={markSrc}
          alt="ShikshaLab"
          className={cn(
            "h-12 w-12 shrink-0 rounded-full border border-border/40 bg-white object-cover shadow-sm sm:h-14 sm:w-14",
            imageClassName,
          )}
        />
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-2.5 sm:gap-3", className)}
      aria-label="ShikshaLab"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={markSrc}
        alt="ShikshaLab"
        width={488}
        height={430}
        decoding="async"
        className={cn(
          // Larger, crisp brand mark — height-driven so type inside the PNG stays readable
          "h-[3.25rem] w-auto max-w-[min(100%,220px)] shrink-0 object-contain object-left sm:h-[3.75rem] sm:max-w-[260px] lg:h-16 lg:max-w-[280px]",
          variant === "onDark" && "brightness-0 invert",
          imageClassName,
        )}
        draggable={false}
      />

      {showWordmark && (
        <span
          className={cn(
            "font-heading text-[1.15rem] font-bold leading-none tracking-tight sm:text-[1.35rem]",
            wordmarkClassName,
          )}
        >
          <span className="text-brand-navy">Shiksha</span>
          <span className="text-brand-orange">Lab</span>
        </span>
      )}
    </span>
  );
}

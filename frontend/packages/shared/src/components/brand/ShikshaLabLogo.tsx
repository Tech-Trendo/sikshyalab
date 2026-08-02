import { cn } from "../../lib/utils";

type Props = {
  className?: string;
  imageClassName?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  src?: string | null;
  rounded?: boolean;
};

const DEFAULT_LOGO = "/shikshalab-logo.png";

export function ShikshaLabLogo({
  className,
  imageClassName,
  showWordmark = false,
  wordmarkClassName,
  src,
  rounded = false,
}: Props) {
  const logoSrc = src?.trim() || DEFAULT_LOGO;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img
        src={logoSrc}
        alt="शिक्षा LAB — ShikshaLab"
        className={cn(
          rounded
            ? "h-10 w-10 shrink-0 rounded-full border border-border/40 bg-white object-cover shadow-sm"
            : "h-10 w-auto max-w-[200px] shrink-0 object-contain object-left",
          imageClassName,
        )}
      />
      {showWordmark && (
        <span className={cn("text-lg font-bold tracking-tight text-primary", wordmarkClassName)}>
          ShikshaLab
        </span>
      )}
    </span>
  );
}

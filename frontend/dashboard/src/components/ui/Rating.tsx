import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const;

export type RatingProps = {
  /** 0–max score. Null/undefined hides stars unless `emptyLabel` is set. */
  value?: number | null;
  max?: number;
  size?: keyof typeof SIZE;
  /** Clickable 1…max picker */
  interactive?: boolean;
  onChange?: (value: number) => void;
  /** Show numeric text e.g. "4.8" */
  showValue?: boolean;
  /** Optional review count shown as "(12)" */
  count?: number | null;
  emptyLabel?: string;
  className?: string;
  starClassName?: string;
};

/**
 * Reusable star rating — display or interactive.
 * Supports fractional fills when not interactive.
 */
export function Rating({
  value,
  max = 5,
  size = "md",
  interactive = false,
  onChange,
  showValue = false,
  count,
  emptyLabel = "No ratings yet",
  className,
  starClassName,
}: RatingProps) {
  const starSize = SIZE[size];
  const hasValue = value != null && Number.isFinite(value) && value > 0;

  if (!hasValue && !interactive) {
    return emptyLabel ? (
      <span className={cn("text-xs text-muted-foreground", className)}>{emptyLabel}</span>
    ) : null;
  }

  const display = hasValue ? Math.min(max, Math.max(0, value!)) : 0;

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)} role={interactive ? "group" : "img"} aria-label={hasValue ? `${display.toFixed(1)} out of ${max}` : "Select a rating"}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }, (_, i) => {
          const n = i + 1;
          if (interactive) {
            const filled = n <= (value ?? 0);
            return (
              <button
                key={n}
                type="button"
                className="rounded p-0.5 transition-colors hover:bg-muted"
                onClick={() => onChange?.(n)}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                aria-pressed={filled}
              >
                <Star
                  className={cn(
                    starSize,
                    filled ? "fill-highlight text-highlight" : "text-muted-foreground",
                    starClassName,
                  )}
                />
              </button>
            );
          }

          const fill = Math.min(1, Math.max(0, display - i));
          return (
            <span key={n} className="relative inline-flex shrink-0">
              <Star className={cn(starSize, "text-muted-foreground/35", starClassName)} />
              {fill > 0 && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  <Star className={cn(starSize, "fill-highlight text-highlight", starClassName)} />
                </span>
              )}
            </span>
          );
        })}
      </div>
      {showValue && hasValue && (
        <span className="text-sm font-semibold tabular-nums text-foreground">{display.toFixed(1)}</span>
      )}
      {count != null && count > 0 && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
